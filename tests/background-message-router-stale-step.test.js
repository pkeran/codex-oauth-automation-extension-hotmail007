const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/message-router.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

function createRouter(overrides = {}) {
  const events = {
    stepStatuses: [],
    notifyCompletions: [],
    notifyErrors: [],
    appended: [],
    logs: [],
  };

  const router = api.createMessageRouter({
    addLog: async (message, level, options = {}) => {
      events.logs.push({ message, level, step: options.step });
    },
    appendAccountRunRecord: async (status, state, reason) => {
      events.appended.push({ status, state, reason });
      return { status, state, reason };
    },
    broadcastDataUpdate: () => {},
    clearStopRequest: () => {},
    executeStep: async () => {},
    executeStepViaCompletionSignal: async () => {},
    finalizePhoneActivationAfterSuccessfulFlow: async () => {},
    finalizeStep3Completion: async () => {},
    finalizeIcloudAliasAfterSuccessfulFlow: async () => {},
    getPendingAutoRunTimerPlan: () => null,
    getSourceLabel: () => '',
    getState: async () => overrides.state || { stepStatuses: {} },
    getStopRequested: () => false,
    handleAutoRunLoopUnhandledError: async () => {},
    isCloudflareSecurityBlockedError: () => false,
    isAutoRunLockedState: () => false,
    isStopError: () => false,
    normalizeRunCount: (value) => value,
    AUTO_RUN_TIMER_KIND_SCHEDULED_START: 'scheduled',
    notifyStepComplete: (step, payload) => {
      events.notifyCompletions.push({ step, payload });
    },
    notifyStepError: (step, error) => {
      events.notifyErrors.push({ step, error });
    },
    setEmailState: async () => {},
    setEmailStateSilently: async () => {},
    setSignupPhoneState: async () => {},
    setSignupPhoneStateSilently: async () => {},
    setPersistentSettings: async () => {},
    setState: async () => {},
    setStepStatus: async (step, status) => {
      events.stepStatuses.push({ step, status });
    },
    skipAutoRunCountdown: async () => false,
    startAutoRunLoop: async () => {},
  });

  return { router, events };
}

test('message router ignores stale STEP_COMPLETE messages for steps that are no longer active', async () => {
  const { router, events } = createRouter({
    state: {
      currentStep: 4,
      stepStatuses: { 3: 'pending', 4: 'running' },
    },
  });

  const response = await router.handleMessage({
    type: 'STEP_COMPLETE',
    step: 3,
    source: 'signup-page',
    payload: { email: 'stale@example.com' },
  }, {});

  assert.deepStrictEqual(response, { ok: true, ignored: true });
  assert.deepStrictEqual(events.stepStatuses, []);
  assert.deepStrictEqual(events.notifyCompletions, []);
});

test('message router propagates explicit failedStep when appending step error records', async () => {
  const { router, events } = createRouter({
    state: {
      autoRunning: true,
      currentStep: 7,
      stepStatuses: { 7: 'running' },
      email: 'user@example.com',
      password: 'secret',
    },
  });

  await router.handleMessage({
    type: 'STEP_ERROR',
    step: 7,
    source: 'signup-page',
    error: 'generic timeout without step marker',
  }, {});

  assert.equal(events.appended.length, 1);
  assert.equal(events.appended[0].status, 'step7_failed');
  assert.equal(events.appended[0].state.failedStep, 7);
});
