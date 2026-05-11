const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const backgroundSource = fs.readFileSync('background.js', 'utf8');
const accountRunHistorySource = fs.readFileSync('background/account-run-history.js', 'utf8');

function extractFunction(source, name) {
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

test('account run history helper keeps running records with explicit step context', () => {
  const globalScope = {};
  const api = new Function('self', `${accountRunHistorySource}; return self.MultiPageBackgroundAccountRunHistory;`)(globalScope);

  const helpers = api.createAccountRunHistoryHelpers({
    chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } },
    getState: async () => ({}),
    normalizeAccountRunHistoryHelperBaseUrl: () => '',
  });

  const record = helpers.buildAccountRunHistoryRecord({
    email: 'running@example.com',
    password: 'secret',
    autoRunning: true,
    autoRunCurrentRun: 1,
    autoRunTotalRuns: 3,
    autoRunAttemptRun: 2,
  }, 'step4_running');

  assert.equal(record.finalStatus, 'running');
  assert.equal(record.failedStep, 4);
  assert.equal(record.source, 'auto');
  assert.deepStrictEqual(record.autoRunContext, {
    currentRun: 1,
    totalRuns: 3,
    attemptRun: 2,
  });
});

test('setStepStatus appends a running account record once auto-run identity is known', async () => {
  const api = new Function(`
let currentState = {
  autoRunning: true,
  email: 'running@example.com',
  password: 'secret',
  stepStatuses: {},
};
const appended = [];
async function getState() {
  return {
    ...currentState,
    stepStatuses: { ...currentState.stepStatuses },
  };
}
async function setState(updates) {
  currentState = {
    ...currentState,
    ...updates,
    stepStatuses: updates.stepStatuses ? { ...updates.stepStatuses } : currentState.stepStatuses,
  };
}
function touchAutoRunStageProgress() {}
async function appendManualAccountRunRecordIfNeeded(status, state, reason) {
  appended.push({ status, state, reason });
}
const chrome = {
  runtime: {
    sendMessage() {
      return Promise.resolve();
    },
  },
};
${extractFunction(backgroundSource, 'setStepStatus')}
return {
  async run() {
    await setStepStatus(4, 'running');
    return appended;
  },
};
`)();

  const appended = await api.run();
  assert.equal(appended.length, 1);
  assert.equal(appended[0].status, 'step4_running');
  assert.equal(appended[0].state.currentStep, 4);
});
