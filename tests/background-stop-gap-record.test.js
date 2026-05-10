const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

test('generic stopped record resolves to next unfinished step during execution gap', async () => {
  const bundle = [
    extractFunction('getRunningSteps'),
    extractFunction('inferStoppedRecordStep'),
    extractFunction('resolveAccountRunRecordStatusForStop'),
    extractFunction('extractStoppedStepFromRecordStatus'),
    extractFunction('resolveAccountRunRecordReasonForStop'),
    extractFunction('buildRunCostSnapshotFromState'),
    extractFunction('attachRecoveredAutoRunOutcome'),
    extractFunction('appendAndBroadcastAccountRunRecord'),
  ].join('\n');

const api = new Function(`
const STEP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const HOTMAIL_PROVIDER = 'hotmail';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const DEFAULT_STATE = {
  stepStatuses: Object.fromEntries(STEP_IDS.map((step) => [step, 'pending'])),
};
let captured = null;
const accountRunHistoryHelpers = {
  appendAccountRunRecord: async (status, state, reason) => {
    captured = { status, state, reason };
    return { status, state, reason };
  },
};
async function broadcastAccountRunHistoryUpdate() {}
async function getState() {
  return {};
}
function isHotmailProvider(state) {
  return String(state?.mailProvider || '').trim() === HOTMAIL_PROVIDER;
}
function isLuckmailProvider(state) {
  return String(state?.mailProvider || '').trim() === LUCKMAIL_PROVIDER;
}
function findHotmailAccount(accounts, accountId) {
  return (Array.isArray(accounts) ? accounts : []).find((account) => account?.id === accountId) || null;
}
function getCurrentLuckmailPurchase(state = {}) {
  return state.currentLuckmailPurchase || null;
}
${bundle}
return {
  inferStoppedRecordStep,
  resolveAccountRunRecordStatusForStop,
  resolveAccountRunRecordReasonForStop,
  appendAndBroadcastAccountRunRecord,
  getCaptured() {
    return captured;
  },
};
`)();

  const state = {
    email: 'user@example.com',
    password: 'secret',
    stepStatuses: {
      1: 'completed',
      2: 'completed',
      3: 'completed',
      4: 'completed',
      5: 'completed',
      6: 'completed',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
    },
  };

  assert.equal(api.inferStoppedRecordStep(state), 7);
  assert.equal(api.resolveAccountRunRecordStatusForStop('stopped', state), 'step7_stopped');
  assert.equal(api.resolveAccountRunRecordReasonForStop('step7_stopped', '流程已被用户停止。'), '步骤 7 已被用户停止。');
  assert.equal(
    api.resolveAccountRunRecordReasonForStop('step2_stopped', '步骤 2 已使用邮箱，流程尚未完成。'),
    '步骤 2 已停止：邮箱已设置，流程尚未完成。'
  );

  await api.appendAndBroadcastAccountRunRecord('stopped', state, '流程已被用户停止。');
  assert.deepStrictEqual(api.getCaptured(), {
    status: 'step7_stopped',
    state: {
      ...state,
      runCosts: null,
    },
    reason: '步骤 7 已被用户停止。',
  });
});

test('requestStop appends a stopped record for the next unfinished step when no step is running', async () => {
  const bundle = [
    extractFunction('normalizeAutoRunSessionId'),
    extractFunction('clearCurrentAutoRunSessionId'),
    extractFunction('cleanupStep8NavigationListeners'),
    extractFunction('rejectPendingStep8'),
    extractFunction('getRunningSteps'),
    extractFunction('inferStoppedRecordStep'),
    extractFunction('requestStop'),
  ].join('\n');

  const api = new Function(`
let stopRequested = false;
let autoRunActive = false;
let autoRunCurrentRun = 0;
let autoRunTotalRuns = 1;
let autoRunAttemptRun = 0;
let autoRunSessionId = 99;
let webNavListener = null;
let webNavCommittedListener = null;
let step8TabUpdatedListener = null;
let step8PendingReject = null;
let resumeWaiter = null;
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const AUTO_RUN_TIMER_KIND_SCHEDULED_START = 'scheduled_start';
const DEFAULT_STATE = {
  stepStatuses: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((step) => [step, 'pending'])),
};
const stepWaiters = new Map();
const appended = [];
const logs = [];
const chrome = {
  webNavigation: {
    onBeforeNavigate: { removeListener() {} },
    onCommitted: { removeListener() {} },
  },
  tabs: {
    onUpdated: { removeListener() {} },
  },
};

function cancelPendingCommands() {}
function abortActiveIcloudRequests() {}
function getPendingAutoRunTimerPlan() {
  return null;
}
async function cancelScheduledAutoRun() {}
async function clearAutoRunTimerAlarm() {}
function clearStopRequest() {
  stopRequested = false;
}
async function addLog(message, level) {
  logs.push({ message, level });
}
async function broadcastStopToContentScripts() {}
async function markRunningStepsStopped() {}
async function broadcastAutoRunStatus() {}
async function appendAndBroadcastAccountRunRecord(status, state, reason) {
  appended.push({ status, state, reason });
  return { status, state, reason };
}
async function getState() {
  return {
    email: 'user@example.com',
    password: 'secret',
    stepStatuses: {
      1: 'completed',
      2: 'completed',
      3: 'completed',
      4: 'completed',
      5: 'completed',
      6: 'completed',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
    },
  };
}

${bundle}

return {
  requestStop,
  snapshot() {
    return { appended, logs, stopRequested, autoRunSessionId };
  },
};
`)();

  await api.requestStop();
  const state = api.snapshot();

  assert.deepStrictEqual(state.appended, [{
    status: 'stopped',
    state: {
      email: 'user@example.com',
      password: 'secret',
      stepStatuses: {
        1: 'completed',
        2: 'completed',
        3: 'completed',
        4: 'completed',
        5: 'completed',
        6: 'completed',
        7: 'pending',
        8: 'pending',
        9: 'pending',
        10: 'pending',
      },
    },
    reason: '流程已被用户停止。',
  }]);
  assert.equal(state.autoRunSessionId, 0);
  assert.equal(state.stopRequested, true);
});

test('appendAndBroadcastAccountRunRecord preserves latest phone completion cost when stale override clears it', async () => {
  const bundle = [
    extractFunction('getRunningSteps'),
    extractFunction('inferStoppedRecordStep'),
    extractFunction('resolveAccountRunRecordStatusForStop'),
    extractFunction('extractStoppedStepFromRecordStatus'),
    extractFunction('resolveAccountRunRecordReasonForStop'),
    extractFunction('buildRunCostSnapshotFromState'),
    extractFunction('attachRecoveredAutoRunOutcome'),
    extractFunction('appendAndBroadcastAccountRunRecord'),
  ].join('\n');

  const api = new Function(`
const STEP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const DEFAULT_STATE = {
  stepStatuses: Object.fromEntries(STEP_IDS.map((step) => [step, 'pending'])),
};
let captured = null;
const latestState = {
  mailProvider: 'hotmail-api',
  email: 'trusted-graph@hotmail.com',
  currentHotmailAccountId: 'hm-1',
  hotmailAccounts: [{
    id: 'hm-1',
    email: 'trusted-graph@hotmail.com',
    source: 'hotmail007',
    purchaseType: 'hotmail Trusted Graph',
    purchasePrice: 0.02,
    purchaseCurrency: 'USD',
    purchaseCostStatus: 'exact',
  }],
  signupMethod: 'phone',
  resolvedSignupMethod: 'phone',
  signupPhoneCompletedActivation: {
    activationId: 'signup-123',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    countryId: 52,
    price: 0.05,
    priceCurrency: 'USD',
    priceStatus: 'exact',
    costOutcome: 'consumed',
  },
};
const accountRunHistoryHelpers = {
  appendAccountRunRecord: async (status, state, reason) => {
    captured = { status, state, reason };
    return { status, state, reason };
  },
};
async function broadcastAccountRunHistoryUpdate() {}
async function getState() {
  return latestState;
}
function isHotmailProvider(state) {
  return String(state?.mailProvider || '').trim() === HOTMAIL_PROVIDER;
}
function isLuckmailProvider(state) {
  return String(state?.mailProvider || '').trim() === LUCKMAIL_PROVIDER;
}
function findHotmailAccount(accounts, accountId) {
  return (Array.isArray(accounts) ? accounts : []).find((account) => account?.id === accountId) || null;
}
function getCurrentLuckmailPurchase(state = {}) {
  return state.currentLuckmailPurchase || null;
}
${bundle}
return {
  appendAndBroadcastAccountRunRecord,
  getCaptured() {
    return captured;
  },
};
`)();

  await api.appendAndBroadcastAccountRunRecord('success', {
    email: 'trusted-graph@hotmail.com',
    accountIdentifierType: 'email',
    accountIdentifier: 'trusted-graph@hotmail.com',
    signupPhoneCompletedActivation: null,
    completedPhoneActivation: null,
  }, '');

  const captured = api.getCaptured();
  assert.equal(captured.status, 'success');
  assert.equal(captured.state.signupPhoneCompletedActivation?.activationId, 'signup-123');
  assert.deepStrictEqual(captured.state.runCosts, {
    mail: {
      provider: 'hotmail007',
      sourceType: 'hotmail Trusted Graph',
      amount: 0.02,
      currency: 'USD',
      status: 'exact',
    },
    phone: {
      provider: 'hero-sms',
      countryId: 52,
      amount: 0.05,
      currency: 'USD',
      status: 'exact',
    },
    total: {
      amount: 0.07,
      currency: 'USD',
      status: 'exact',
    },
  });
});

test('appendAndBroadcastAccountRunRecord keeps consumed signup phone activation cost for failed phone-signup runs before activation is completed', async () => {
  const bundle = [
    extractFunction('getRunningSteps'),
    extractFunction('inferStoppedRecordStep'),
    extractFunction('resolveAccountRunRecordStatusForStop'),
    extractFunction('extractStoppedStepFromRecordStatus'),
    extractFunction('resolveAccountRunRecordReasonForStop'),
    extractFunction('buildRunCostSnapshotFromState'),
    extractFunction('attachRecoveredAutoRunOutcome'),
    extractFunction('appendAndBroadcastAccountRunRecord'),
  ].join('\n');

  const api = new Function(`
const STEP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const DEFAULT_STATE = {
  stepStatuses: Object.fromEntries(STEP_IDS.map((step) => [step, 'pending'])),
};
let captured = null;
const latestState = {
  accountIdentifierType: 'phone',
  accountIdentifier: '66959916439',
  signupMethod: 'phone',
  resolvedSignupMethod: 'phone',
  signupPhoneNumber: '66959916439',
  signupPhoneActivation: {
    activationId: 'signup-verify-123',
    latestActivationId: 'signup-verify-123',
    phoneNumber: '66959916439',
    provider: 'hero-sms',
    countryId: 52,
    price: 0.05,
    priceCurrency: 'USD',
    priceStatus: 'exact',
    costOutcome: 'consumed',
  },
};
const accountRunHistoryHelpers = {
  appendAccountRunRecord: async (status, state, reason) => {
    captured = { status, state, reason };
    return { status, state, reason };
  },
};
async function broadcastAccountRunHistoryUpdate() {}
async function getState() {
  return latestState;
}
function isHotmailProvider(state) {
  return String(state?.mailProvider || '').trim() === HOTMAIL_PROVIDER;
}
function isLuckmailProvider(state) {
  return String(state?.mailProvider || '').trim() === LUCKMAIL_PROVIDER;
}
function findHotmailAccount(accounts, accountId) {
  return (Array.isArray(accounts) ? accounts : []).find((account) => account?.id === accountId) || null;
}
function getCurrentLuckmailPurchase(state = {}) {
  return state.currentLuckmailPurchase || null;
}
${bundle}
return {
  appendAndBroadcastAccountRunRecord,
  getCaptured() {
    return captured;
  },
};
`)();

  await api.appendAndBroadcastAccountRunRecord('step4_failed', null, '步骤 4：手机号验证码通过后流程失败。');

  const captured = api.getCaptured();
  assert.equal(captured.status, 'step4_failed');
  assert.equal(captured.state.signupPhoneActivation?.activationId, 'signup-verify-123');
  assert.deepStrictEqual(captured.state.runCosts, {
    phone: {
      provider: 'hero-sms',
      countryId: 52,
      amount: 0.05,
      currency: 'USD',
      status: 'exact',
    },
    total: {
      amount: 0.05,
      currency: 'USD',
      status: 'exact',
    },
  });
});
