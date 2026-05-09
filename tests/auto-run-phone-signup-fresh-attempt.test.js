const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);

function createHarness(options = {}) {
  const {
    initialState = {},
    firstFailureMessage = 'RESTART_CURRENT_ATTEMPT::phone signup completed flow should retry without buying a new phone',
    firstFailureCode = 'RESTART_CURRENT_ATTEMPT',
    firstFailureResumeStepHint = 0,
    restartCurrentAttemptMatcher = null,
    addPhoneFailureMatcher = null,
    phoneSmsRateLimitMatcher = null,
  } = options;

  const events = {
    logs: [],
    startSteps: [],
    stateSnapshots: [],
  };

  let currentState = {
    stepStatuses: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed', 5: 'completed', 6: 'completed' },
    vpsUrl: 'https://example.com/vps',
    vpsPassword: 'secret',
    password: null,
    customPassword: '',
    autoRunSkipFailures: false,
    autoRunNeverStop: false,
    autoRunFallbackThreadIntervalMinutes: 0,
    autoRunDelayEnabled: false,
    autoRunDelayMinutes: 30,
    autoStepDelaySeconds: null,
    signupMethod: 'phone',
    resolvedSignupMethod: 'phone',
    accountIdentifierType: 'phone',
    accountIdentifier: '+6612345',
    signupPhoneNumber: '',
    signupPhoneActivation: null,
    signupPhoneCompletedActivation: null,
    signupPhoneVerificationRequestedAt: null,
    signupPhoneVerificationPurpose: '',
    mailProvider: '163',
    emailGenerator: 'duck',
    gmailBaseEmail: '',
    mail2925BaseEmail: '',
    emailPrefix: 'demo',
    inbucketHost: '',
    inbucketMailbox: '',
    cloudflareDomain: '',
    cloudflareDomains: [],
    reusablePhoneActivation: null,
    tabRegistry: { 'signup-page': { tabId: 99 } },
    sourceLastUrls: { 'signup-page': 'https://auth.openai.com/authorize' },
    autoRunRoundSummaries: [],
    ...initialState,
  };

  const runtime = {
    state: {
      autoRunActive: false,
      autoRunCurrentRun: 0,
      autoRunTotalRuns: 1,
      autoRunAttemptRun: 0,
      autoRunSessionId: 0,
    },
    get() {
      return { ...this.state };
    },
    set(updates = {}) {
      this.state = { ...this.state, ...updates };
    },
  };

  let sessionSeed = 0;
  let runCount = 0;

  const controller = api.createAutoRunController({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    appendAccountRunRecord: async () => ({ ok: true }),
    AUTO_RUN_MAX_RETRIES_PER_ROUND: 3,
    AUTO_RUN_RETRY_DELAY_MS: 1,
    AUTO_RUN_TIMER_KIND_BEFORE_RETRY: 'before_retry',
    AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS: 'between_rounds',
    broadcastAutoRunStatus: async (phase, payload = {}) => {
      currentState = {
        ...currentState,
        autoRunPhase: phase,
        autoRunCurrentRun: payload.currentRun ?? currentState.autoRunCurrentRun ?? 0,
        autoRunTotalRuns: payload.totalRuns ?? currentState.autoRunTotalRuns ?? 1,
        autoRunAttemptRun: payload.attemptRun ?? currentState.autoRunAttemptRun ?? 0,
        autoRunSessionId: payload.sessionId ?? currentState.autoRunSessionId ?? 0,
      };
    },
    broadcastStopToContentScripts: async () => {},
    cancelPendingCommands: () => {},
    clearStopRequest: () => {},
    createAutoRunSessionId: () => {
      sessionSeed += 1;
      return sessionSeed;
    },
    getAutoRunStatusPayload: (phase, payload = {}) => ({
      autoRunning: ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
      autoRunPhase: phase,
      autoRunCurrentRun: payload.currentRun ?? 0,
      autoRunTotalRuns: payload.totalRuns ?? 1,
      autoRunAttemptRun: payload.attemptRun ?? 0,
      autoRunSessionId: payload.sessionId ?? 0,
    }),
    getErrorMessage: (error) => error?.message || String(error || ''),
    getFirstUnfinishedStep: () => 1,
    getPendingAutoRunTimerPlan: () => null,
    getRunningSteps: () => [],
    getState: async () => ({
      ...currentState,
      stepStatuses: { ...(currentState.stepStatuses || {}) },
      tabRegistry: { ...(currentState.tabRegistry || {}) },
      sourceLastUrls: { ...(currentState.sourceLastUrls || {}) },
    }),
    getStopRequested: () => false,
    hasSavedProgress: () => false,
    isAddPhoneAuthFailure: typeof addPhoneFailureMatcher === 'function'
      ? addPhoneFailureMatcher
      : (() => false),
    isBrowserSwitchRequiredFailure: () => false,
    isConfigurationFatalFailure: () => false,
    isMailboxProviderTransientFailure: () => false,
    isPhoneSmsPlatformRateLimitFailure: typeof phoneSmsRateLimitMatcher === 'function'
      ? phoneSmsRateLimitMatcher
      : (() => false),
    isPlusCheckoutNonFreeTrialFailure: () => false,
    isRestartCurrentAttemptError: typeof restartCurrentAttemptMatcher === 'function'
      ? restartCurrentAttemptMatcher
      : ((error) => String(error?.code || '').trim() === 'RESTART_CURRENT_ATTEMPT'
        || /^RESTART_CURRENT_ATTEMPT::/.test(String(error?.message || ''))),
    isSecurityBlockedFailure: () => false,
    isSignupUserAlreadyExistsFailure: () => false,
    isStep4Route405RecoveryLimitFailure: () => false,
    isStopError: (error) => (error?.message || String(error || '')) === '流程已被用户停止。',
    launchAutoRunTimerPlan: async () => false,
    normalizeAutoRunFallbackThreadIntervalMinutes: (value) => Math.max(0, Math.floor(Number(value) || 0)),
    persistAutoRunTimerPlan: async () => ({}),
    releaseCurrentHotmailSelectionAfterFailure: async () => {},
    resetState: async () => {
      const prev = { ...currentState };
      currentState = {
        stepStatuses: {},
        vpsUrl: prev.vpsUrl,
        vpsPassword: prev.vpsPassword,
        customPassword: prev.customPassword,
        signupMethod: prev.signupMethod,
        resolvedSignupMethod: null,
        accountIdentifierType: null,
        accountIdentifier: '',
        signupPhoneNumber: '',
        signupPhoneActivation: null,
        signupPhoneCompletedActivation: null,
        signupPhoneVerificationRequestedAt: null,
        signupPhoneVerificationPurpose: '',
        password: null,
        mailProvider: prev.mailProvider,
        emailGenerator: prev.emailGenerator,
        gmailBaseEmail: prev.gmailBaseEmail,
        mail2925BaseEmail: prev.mail2925BaseEmail,
        emailPrefix: prev.emailPrefix,
        inbucketHost: prev.inbucketHost,
        inbucketMailbox: prev.inbucketMailbox,
        cloudflareDomain: prev.cloudflareDomain,
        cloudflareDomains: [...(prev.cloudflareDomains || [])],
        reusablePhoneActivation: prev.reusablePhoneActivation,
        tabRegistry: {},
        sourceLastUrls: {},
      };
    },
    runAutoSequenceFromStep: async (startStep, payload = {}) => {
      runCount += 1;
      events.startSteps.push(startStep);
      events.stateSnapshots.push({
        startStep,
        attemptRun: payload.attemptRuns,
        password: currentState.password,
        signupPhoneNumber: currentState.signupPhoneNumber,
        signupPhoneCompletedActivation: currentState.signupPhoneCompletedActivation
          ? { ...currentState.signupPhoneCompletedActivation }
          : null,
        accountIdentifierType: currentState.accountIdentifierType,
        accountIdentifier: currentState.accountIdentifier,
        tabRegistry: { ...(currentState.tabRegistry || {}) },
        sourceLastUrls: { ...(currentState.sourceLastUrls || {}) },
      });
      if (runCount === 1) {
        currentState = {
          ...currentState,
          password: 'auto-generated-pass',
          signupPhoneNumber: '+6612345',
          signupPhoneCompletedActivation: {
            activationId: 'signup-completed',
            phoneNumber: '+6612345',
            provider: 'hero-sms',
            serviceCode: 'dr',
            countryId: 52,
            costOutcome: 'consumed',
            phoneVerificationSuccessCount: 1,
          },
          accountIdentifierType: 'phone',
          accountIdentifier: '+6612345',
          tabRegistry: { 'signup-page': { tabId: 99 } },
          sourceLastUrls: { 'signup-page': 'https://auth.openai.com/authorize' },
        };
        const error = new Error(firstFailureMessage);
        if (firstFailureCode) {
          error.code = firstFailureCode;
        }
        if (firstFailureResumeStepHint > 0) {
          error.phoneSignupFreshAttemptResumeStep = firstFailureResumeStepHint;
        }
        throw error;
      }
      return {};
    },
    runtime,
    setState: async (updates = {}) => {
      currentState = {
        ...currentState,
        ...updates,
        stepStatuses: updates.stepStatuses ? { ...updates.stepStatuses } : currentState.stepStatuses,
        tabRegistry: updates.tabRegistry ? { ...updates.tabRegistry } : currentState.tabRegistry,
        sourceLastUrls: updates.sourceLastUrls ? { ...updates.sourceLastUrls } : currentState.sourceLastUrls,
      };
    },
    sleepWithStop: async () => {},
    throwIfAutoRunSessionStopped: (sessionId) => {
      if (sessionId && sessionId !== runtime.state.autoRunSessionId) {
        throw new Error('流程已被用户停止。');
      }
    },
    waitForRunningStepsToFinish: async () => currentState,
    chrome: {
      runtime: {
        sendMessage() {
          return Promise.resolve();
        },
      },
    },
  });

  return { controller, events };
}

test('auto-run fresh attempt preserves consumed phone-signup completion and resumes from step 7', async () => {
  const { controller, events } = createHarness();

  await controller.autoRunLoop(1, {
    autoRunSkipFailures: false,
    mode: 'restart',
  });

  assert.deepStrictEqual(events.startSteps, [1, 7]);
  assert.equal(events.stateSnapshots[1]?.password, 'auto-generated-pass');
  assert.equal(events.stateSnapshots[1]?.signupPhoneNumber, '+6612345');
  assert.equal(events.stateSnapshots[1]?.signupPhoneCompletedActivation?.activationId, 'signup-completed');
  assert.equal(events.stateSnapshots[1]?.signupPhoneCompletedActivation?.costOutcome, 'consumed');
});

test('auto-run generic fresh retry after step 5 preserves consumed phone-signup completion and keeps signup tab context', async () => {
  const { controller, events } = createHarness({
    firstFailureMessage: 'step5 generic failure after phone signup verification',
    firstFailureCode: '',
    firstFailureResumeStepHint: 5,
    restartCurrentAttemptMatcher: () => false,
  });

  await controller.autoRunLoop(1, {
    autoRunSkipFailures: true,
    mode: 'restart',
  });

  assert.deepStrictEqual(events.startSteps, [1, 5]);
  assert.equal(events.stateSnapshots[1]?.password, 'auto-generated-pass');
  assert.equal(events.stateSnapshots[1]?.signupPhoneCompletedActivation?.activationId, 'signup-completed');
  assert.equal(events.stateSnapshots[1]?.accountIdentifierType, 'phone');
  assert.equal(events.stateSnapshots[1]?.accountIdentifier, '+6612345');
  assert.deepStrictEqual(events.stateSnapshots[1]?.tabRegistry, { 'signup-page': { tabId: 99 } });
  assert.deepStrictEqual(events.stateSnapshots[1]?.sourceLastUrls, { 'signup-page': 'https://auth.openai.com/authorize' });
});

test('auto-run generic fresh retry after step 6 preserves consumed phone-signup completion and resumes from step 6', async () => {
  const { controller, events } = createHarness({
    firstFailureMessage: 'step6 generic failure after registration success wait',
    firstFailureCode: '',
    firstFailureResumeStepHint: 6,
    restartCurrentAttemptMatcher: () => false,
  });

  await controller.autoRunLoop(1, {
    autoRunSkipFailures: true,
    mode: 'restart',
  });

  assert.deepStrictEqual(events.startSteps, [1, 6]);
  assert.equal(events.stateSnapshots[1]?.password, 'auto-generated-pass');
  assert.equal(events.stateSnapshots[1]?.signupPhoneCompletedActivation?.activationId, 'signup-completed');
  assert.deepStrictEqual(events.stateSnapshots[1]?.tabRegistry, { 'signup-page': { tabId: 99 } });
});

test('auto-run generic fresh retry does not preserve consumed phone-signup completion when error carries explicit retired-phone semantics', async () => {
  const { controller, events } = createHarness({
    firstFailureMessage: 'PHONE_SIGNUP_NUMBER_USED::the current number has already been used',
    firstFailureCode: 'PHONE_SIGNUP_NUMBER_USED',
    firstFailureResumeStepHint: 7,
    restartCurrentAttemptMatcher: () => false,
  });

  await controller.autoRunLoop(1, {
    autoRunSkipFailures: true,
    mode: 'restart',
  });

  assert.deepStrictEqual(events.startSteps, [1, 1]);
  assert.equal(events.stateSnapshots[1]?.signupPhoneCompletedActivation, null);
  assert.deepStrictEqual(events.stateSnapshots[1]?.tabRegistry, {});
});
