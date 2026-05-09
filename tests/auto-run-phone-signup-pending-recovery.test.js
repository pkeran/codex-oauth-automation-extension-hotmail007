const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);

function createHarness(options = {}) {
  const {
    firstFailureMessage = 'RESTART_CURRENT_ATTEMPT::step4 http500 should preserve current phone activation',
    firstFailureCode = 'RESTART_CURRENT_ATTEMPT',
    firstFailureReason = 'PHONE_SIGNUP_VERIFICATION_HTTP_500',
    firstFailureResumeStepHint = 2,
  } = options;

  const events = {
    startSteps: [],
    stateSnapshots: [],
  };

  let currentState = {
    stepStatuses: { 1: 'completed', 2: 'completed', 3: 'completed' },
    signupMethod: 'phone',
    resolvedSignupMethod: 'phone',
    accountIdentifierType: null,
    accountIdentifier: '',
    signupPhoneNumber: '',
    signupPhoneActivation: null,
    signupPhoneCompletedActivation: null,
    signupPhoneVerificationRequestedAt: null,
    signupPhoneVerificationPurpose: '',
    currentPhoneVerificationCode: '',
    password: null,
    customPassword: '',
    autoRunSkipFailures: false,
    autoRunNeverStop: false,
    autoRunFallbackThreadIntervalMinutes: 0,
    autoRunDelayEnabled: false,
    autoRunDelayMinutes: 30,
    autoStepDelaySeconds: null,
    vpsUrl: 'https://example.com/vps',
    vpsPassword: 'secret',
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
    sourceLastUrls: { 'signup-page': 'https://auth.openai.com/contact-verification' },
    autoRunRoundSummaries: [],
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
    addLog: async () => {},
    appendAccountRunRecord: async () => ({ ok: true }),
    AUTO_RUN_MAX_RETRIES_PER_ROUND: 3,
    AUTO_RUN_RETRY_DELAY_MS: 1,
    AUTO_RUN_TIMER_KIND_BEFORE_RETRY: 'before_retry',
    AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS: 'between_rounds',
    broadcastAutoRunStatus: async () => {},
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
    isAddPhoneAuthFailure: () => false,
    isBrowserSwitchRequiredFailure: () => false,
    isConfigurationFatalFailure: () => false,
    isMailboxProviderTransientFailure: () => false,
    isPhoneSmsPlatformRateLimitFailure: () => false,
    isPlusCheckoutNonFreeTrialFailure: () => false,
    isRestartCurrentAttemptError: (error) => String(error?.code || '').trim() === 'RESTART_CURRENT_ATTEMPT'
      || /^RESTART_CURRENT_ATTEMPT::/.test(String(error?.message || '')),
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
        signupMethod: prev.signupMethod,
        resolvedSignupMethod: null,
        signupPhoneNumber: '',
        signupPhoneActivation: null,
        signupPhoneCompletedActivation: null,
        signupPhoneVerificationRequestedAt: null,
        signupPhoneVerificationPurpose: '',
        currentPhoneVerificationCode: '',
        accountIdentifierType: null,
        accountIdentifier: '',
        password: null,
        customPassword: prev.customPassword,
        vpsUrl: prev.vpsUrl,
        vpsPassword: prev.vpsPassword,
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
    runAutoSequenceFromStep: async (startStep) => {
      runCount += 1;
      events.startSteps.push(startStep);
      events.stateSnapshots.push({
        startStep,
        password: currentState.password,
        signupPhoneNumber: currentState.signupPhoneNumber,
        signupPhoneActivation: currentState.signupPhoneActivation
          ? { ...currentState.signupPhoneActivation }
          : null,
        currentPhoneVerificationCode: currentState.currentPhoneVerificationCode,
        signupPhoneVerificationPurpose: currentState.signupPhoneVerificationPurpose,
        tabRegistry: { ...(currentState.tabRegistry || {}) },
        sourceLastUrls: { ...(currentState.sourceLastUrls || {}) },
      });
      if (runCount === 1) {
        currentState = {
          ...currentState,
          password: 'auto-generated-pass',
          signupPhoneNumber: '+6612345',
          signupPhoneActivation: {
            activationId: 'signup-pending',
            phoneNumber: '+6612345',
            provider: 'hero-sms',
            serviceCode: 'dr',
            countryId: 52,
            step4Http500RecoveryCount: 1,
          },
          signupPhoneVerificationRequestedAt: 1710000000000,
          signupPhoneVerificationPurpose: 'signup',
          currentPhoneVerificationCode: '230059',
          accountIdentifierType: 'phone',
          accountIdentifier: '+6612345',
        };
        const error = new Error(firstFailureMessage);
        error.code = firstFailureCode;
        error.reason = firstFailureReason;
        error.phoneSignupFreshAttemptResumeStep = firstFailureResumeStepHint;
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
    throwIfAutoRunSessionStopped: () => {},
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

test('auto-run fresh attempt preserves pending phone-signup activation after step4 http500 and resumes from step 2', async () => {
  const { controller, events } = createHarness();

  await controller.autoRunLoop(1, {
    autoRunSkipFailures: false,
    mode: 'restart',
  });

  assert.deepStrictEqual(events.startSteps, [1, 2]);
  assert.equal(events.stateSnapshots[1]?.password, 'auto-generated-pass');
  assert.equal(events.stateSnapshots[1]?.signupPhoneNumber, '+6612345');
  assert.equal(events.stateSnapshots[1]?.signupPhoneActivation?.activationId, 'signup-pending');
  assert.equal(events.stateSnapshots[1]?.signupPhoneActivation?.step4Http500RecoveryCount, 1);
  assert.equal(events.stateSnapshots[1]?.currentPhoneVerificationCode, '230059');
  assert.equal(events.stateSnapshots[1]?.signupPhoneVerificationPurpose, 'signup');
});
