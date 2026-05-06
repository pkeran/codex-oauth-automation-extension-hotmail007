const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);

function createHarness(options = {}) {
  const {
    totalRuns = 2,
    autoRunSkipFailures = true,
    ensureHotmailMailboxReadyForAutoRunRound,
    runImpl = async () => {},
    extraDeps = {},
    stateOverrides = {},
  } = options;

  const events = {
    logs: [],
    broadcasts: [],
    accountRecords: [],
    runTargets: [],
    sleeps: [],
    preflightCalls: [],
  };

  let currentState = {
    stepStatuses: {},
    vpsUrl: 'https://example.com/vps',
    vpsPassword: 'secret',
    customPassword: '',
    autoRunSkipFailures,
    autoRunFallbackThreadIntervalMinutes: 0,
    autoRunDelayEnabled: false,
    autoRunDelayMinutes: 30,
    autoStepDelaySeconds: null,
    mailProvider: '163',
    emailGenerator: 'duck',
    gmailBaseEmail: '',
    mail2925BaseEmail: '',
    emailPrefix: 'demo',
    inbucketHost: '',
    inbucketMailbox: '',
    cloudflareDomain: '',
    cloudflareDomains: [],
    tabRegistry: {},
    sourceLastUrls: {},
    autoRunRoundSummaries: [],
    ...stateOverrides,
  };

  const runtime = {
    state: {
      autoRunActive: false,
      autoRunCurrentRun: 0,
      autoRunTotalRuns: totalRuns,
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

  const controller = api.createAutoRunController({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    appendAccountRunRecord: async (status, _state, reason) => {
      events.accountRecords.push({ status, reason });
      return { status, reason };
    },
    AUTO_RUN_MAX_RETRIES_PER_ROUND: 3,
    AUTO_RUN_RETRY_DELAY_MS: 3000,
    AUTO_RUN_TIMER_KIND_BEFORE_RETRY: 'before_retry',
    AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS: 'between_rounds',
    broadcastAutoRunStatus: async (phase, payload = {}) => {
      events.broadcasts.push({ phase, ...payload });
      currentState = {
        ...currentState,
        autoRunning: ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
        autoRunPhase: phase,
        autoRunCurrentRun: payload.currentRun ?? runtime.state.autoRunCurrentRun,
        autoRunTotalRuns: payload.totalRuns ?? runtime.state.autoRunTotalRuns,
        autoRunAttemptRun: payload.attemptRun ?? runtime.state.autoRunAttemptRun,
        autoRunSessionId: payload.sessionId ?? runtime.state.autoRunSessionId,
      };
    },
    broadcastStopToContentScripts: async () => {},
    cancelPendingCommands: () => {},
    clearStopRequest: () => {},
    createAutoRunSessionId: () => {
      sessionSeed += 1;
      return sessionSeed;
    },
    ensureHotmailMailboxReadyForAutoRunRound: typeof ensureHotmailMailboxReadyForAutoRunRound === 'function'
      ? async (payload = {}) => {
        events.preflightCalls.push(payload);
        return ensureHotmailMailboxReadyForAutoRunRound(payload);
      }
      : undefined,
    getAutoRunStatusPayload: (phase, payload = {}) => ({
      autoRunning: ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
      autoRunPhase: phase,
      autoRunCurrentRun: payload.currentRun ?? 0,
      autoRunTotalRuns: payload.totalRuns ?? totalRuns,
      autoRunAttemptRun: payload.attemptRun ?? 0,
      autoRunSessionId: payload.sessionId ?? 0,
    }),
    getErrorMessage: (error) => error?.message || String(error || ''),
    getFirstUnfinishedStep: () => 1,
    getPendingAutoRunTimerPlan: () => null,
    getRunningSteps: () => [],
    getStructuredErrorCode: (error) => String(error?.code || '').trim(),
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
    isRestartCurrentAttemptError: () => false,
    isSecurityBlockedFailure: () => false,
    isSignupUserAlreadyExistsFailure: () => false,
    isStep4Route405RecoveryLimitFailure: () => false,
    isStopError: (error) => (error?.message || String(error || '')) === '流程已被用户停止。',
    launchAutoRunTimerPlan: async () => false,
    normalizeAutoRunFallbackThreadIntervalMinutes: (value) => Math.max(0, Math.floor(Number(value) || 0)),
    persistAutoRunTimerPlan: async () => ({}),
    releaseCurrentHotmailSelectionAfterFailure: async () => {},
    resetState: async () => {
      currentState = {
        ...currentState,
        stepStatuses: {},
        tabRegistry: {},
        sourceLastUrls: {},
      };
    },
    runAutoSequenceFromStep: async (_startStep, payload = {}) => {
      events.runTargets.push(payload.targetRun);
      return runImpl(payload);
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
    sleepWithStop: async (ms) => {
      events.sleeps.push(ms);
    },
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
    ...extraDeps,
  });

  return {
    controller,
    events,
    runtime,
  };
}

test('auto-run controller stops globally on CF_SECURITY_BLOCKED even when skip-failures is enabled', async () => {
  const { controller, events, runtime } = createHarness({
    totalRuns: 2,
    runImpl: async () => {
      const error = new Error('CF_SECURITY_BLOCKED::cloudflare blocked');
      error.code = 'CF_SECURITY_BLOCKED';
      throw error;
    },
    extraDeps: {
      isSecurityBlockedFailure: (error) => String(error?.code || '').trim() === 'CF_SECURITY_BLOCKED'
        || /^CF_SECURITY_BLOCKED::/.test(String(error?.message || error || '')),
    },
  });

  await controller.autoRunLoop(2, {
    autoRunSkipFailures: true,
    mode: 'restart',
  });

  assert.deepEqual(events.runTargets, [1], 'security block should stop immediately instead of continuing into later rounds');
  assert.equal(events.broadcasts.some(({ phase }) => phase === 'retrying'), false, 'security block must not enter same-round retrying');
  assert.equal(events.broadcasts.some(({ phase }) => phase === 'stopped'), true, 'security block should stop the whole auto-run');
  assert.equal(events.accountRecords.length, 1);
  assert.equal(events.accountRecords[0].status, 'failed');
  assert.match(events.accountRecords[0].reason, /CF_SECURITY_BLOCKED::/);
  assert.equal(runtime.state.autoRunActive, false);
  assert.equal(runtime.state.autoRunSessionId, 0);
});

test('auto-run controller stops globally on BROWSER_SWITCH_REQUIRED even when skip-failures is enabled', async () => {
  const { controller, events, runtime } = createHarness({
    totalRuns: 2,
    runImpl: async () => {
      const error = new Error('BROWSER_SWITCH_REQUIRED::manual intervention required');
      error.code = 'BROWSER_SWITCH_REQUIRED';
      throw error;
    },
    extraDeps: {
      isBrowserSwitchRequiredFailure: (error) => String(error?.code || '').trim() === 'BROWSER_SWITCH_REQUIRED'
        || /^BROWSER_SWITCH_REQUIRED::/.test(String(error?.message || error || '')),
    },
  });

  await controller.autoRunLoop(2, {
    autoRunSkipFailures: true,
    mode: 'restart',
  });

  assert.deepEqual(events.runTargets, [1], 'browser switch requirement should stop immediately instead of continuing into later rounds');
  assert.equal(events.broadcasts.some(({ phase }) => phase === 'retrying'), false, 'browser switch requirement must not enter same-round retrying');
  assert.equal(events.broadcasts.some(({ phase }) => phase === 'stopped'), true, 'browser switch requirement should stop the whole auto-run');
  assert.equal(events.accountRecords.length, 1);
  assert.equal(events.accountRecords[0].status, 'failed');
  assert.match(events.accountRecords[0].reason, /BROWSER_SWITCH_REQUIRED::/);
  assert.equal(runtime.state.autoRunActive, false);
  assert.equal(runtime.state.autoRunSessionId, 0);
});

test('auto-run controller treats HOTMAIL007_NO_STOCK as round-fatal and skips same-round retries', async () => {
  let preflightAttempts = 0;
  const { controller, events } = createHarness({
    totalRuns: 2,
    ensureHotmailMailboxReadyForAutoRunRound: async () => {
      preflightAttempts += 1;
      if (preflightAttempts === 1) {
        const error = new Error('Hotmail007 当前无库存');
        error.code = 'HOTMAIL007_NO_STOCK';
        throw error;
      }
      return null;
    },
    extraDeps: {
      isMailboxProviderTransientFailure: () => false,
    },
  });

  await controller.autoRunLoop(2, {
    autoRunSkipFailures: true,
    mode: 'restart',
  });

  assert.equal(preflightAttempts, 2, 'preflight should be retried only in the next round');
  assert.deepEqual(events.runTargets, [2], 'no-stock round should fail fast and only the next round should execute the flow');
  assert.equal(events.broadcasts.some(({ phase }) => phase === 'retrying'), false, 'no-stock should not trigger same-round retrying');
  assert.equal(events.accountRecords.length, 1);
  assert.equal(events.accountRecords[0].status, 'failed');
  assert.equal(events.accountRecords[0].reason, 'Hotmail007 当前无库存');
});

test('auto-run controller treats HOTMAIL_ACCOUNT_INVALID as round-fatal and skips same-round retries', async () => {
  let preflightAttempts = 0;
  const { controller, events } = createHarness({
    totalRuns: 2,
    ensureHotmailMailboxReadyForAutoRunRound: async () => {
      preflightAttempts += 1;
      if (preflightAttempts === 1) {
        const error = new Error('Hotmail account invalid');
        error.code = 'HOTMAIL_ACCOUNT_INVALID';
        throw error;
      }
      return null;
    },
    extraDeps: {
      isConfigurationFatalFailure: () => false,
    },
  });

  await controller.autoRunLoop(2, {
    autoRunSkipFailures: true,
    mode: 'restart',
  });

  assert.equal(preflightAttempts, 2, 'invalid-account preflight should be retried only in the next round');
  assert.deepEqual(events.runTargets, [2], 'invalid-account round should fail fast and only the next round should execute the flow');
  assert.equal(events.broadcasts.some(({ phase }) => phase === 'retrying'), false, 'invalid-account should not trigger same-round retrying');
  assert.equal(events.accountRecords.length, 1);
  assert.equal(events.accountRecords[0].status, 'failed');
  assert.equal(events.accountRecords[0].reason, 'Hotmail account invalid');
});

test('auto-run controller retries STEP3_PHONE_CREDENTIAL_INVALID in the same round even when auto retry is disabled', async () => {
  let attempts = 0;
  const { controller, events } = createHarness({
    totalRuns: 1,
    autoRunSkipFailures: false,
    runImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error('step 3 phone credential invalid');
        error.code = 'STEP3_PHONE_CREDENTIAL_INVALID';
        throw error;
      }
      return {};
    },
  });

  await controller.autoRunLoop(1, {
    autoRunSkipFailures: false,
    mode: 'restart',
  });

  assert.equal(attempts, 2);
  assert.deepEqual(events.runTargets, [1, 1]);
  assert.equal(events.broadcasts.some(({ phase }) => phase === 'retrying'), true);
  assert.equal(events.accountRecords.some(({ status }) => status === 'failed'), false);
});
