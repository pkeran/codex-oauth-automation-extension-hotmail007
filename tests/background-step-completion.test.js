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
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
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

function createApi(events, lastStepId = 10) {
  return new Function('events', 'lastStepId', `
let stopRequested = false;
const LOG_PREFIX = '[test]';
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const LAST_STEP_ID = 10;
function getErrorMessage(error) {
  return error?.message || String(error || '');
}
async function getState() {
  events.push({ type: 'getState' });
  return { stepStatuses: {}, contributionMode: true };
}
function getLastStepIdForState() {
  return lastStepId;
}
async function setStepStatus(step, status) {
  events.push({ type: 'status', step, status });
}
async function addLog(message, level) {
  events.push({ type: 'log', message, level });
}
async function appendManualAccountRunRecordIfNeeded() {
  events.push({ type: 'manual-record' });
}
function notifyStepError(step, error) {
  events.push({ type: 'error', step, error });
}
function notifyStepComplete(step, payload) {
  events.push({ type: 'notify', step, payload });
}
async function handleStepData(step, payload) {
  events.push({ type: 'handle-start', step, payload });
  await new Promise((resolve) => setTimeout(resolve, 25));
  events.push({ type: 'handle-done', step });
}
async function appendAndBroadcastAccountRunRecord(status, state) {
  events.push({ type: 'record', status, state });
}
${extractFunction('attachRecoveredAutoRunOutcome')}
${extractFunction('runCompletedStepSideEffects')}
${extractFunction('reportCompletedStepSideEffectError')}
${extractFunction('completeStepFromBackground')}
return { completeStepFromBackground };
`)(events, lastStepId);
}

test('completeStepFromBackground releases final step before slow post-completion side effects', async () => {
  const events = [];
  const api = createApi(events, 10);

  await api.completeStepFromBackground(10, { localhostUrl: 'http://localhost:1455/auth/callback?code=ok' });

  const types = events.map((event) => event.type);
  assert.equal(types.indexOf('notify') < types.indexOf('handle-start'), true);
  assert.equal(types.includes('handle-done'), false);
  assert.equal(types.includes('record'), false);

  await new Promise((resolve) => setTimeout(resolve, 40));

  const settledTypes = events.map((event) => event.type);
  assert.equal(settledTypes.includes('handle-done'), true);
  assert.equal(settledTypes.includes('record'), true);
});

test('completeStepFromBackground keeps non-final step data handling before completion signal', async () => {
  const events = [];
  const api = createApi(events, 10);

  await api.completeStepFromBackground(9, { localhostUrl: 'http://localhost:1455/auth/callback?code=ok' });

  const types = events.map((event) => event.type);
  assert.equal(types.indexOf('handle-done') < types.indexOf('notify'), true);
  assert.equal(types.includes('record'), false);
});

test('completeStepFromBackground passes recovered success markers into final account run record', async () => {
  const events = [];
  const api = new Function('events', `
let stopRequested = false;
const LOG_PREFIX = '[test]';
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const LAST_STEP_ID = 10;
function getErrorMessage(error) {
  return error?.message || String(error || '');
}
async function getState() {
  return {
    stepStatuses: {},
    contributionMode: true,
    autoRunning: true,
    autoRunCurrentRun: 1,
    autoRunRoundSummaries: [
      {
        round: 1,
        status: 'success',
        attempts: 2,
        failureReasons: ['STEP3_PAGE_COMM_TIMEOUT::timeout'],
        finalFailureReason: '',
      },
    ],
  };
}
function getLastStepIdForState() {
  return 10;
}
async function setStepStatus() {}
async function addLog() {}
async function appendManualAccountRunRecordIfNeeded() {}
function notifyStepError() {}
function notifyStepComplete() {}
async function handleStepData() {}
async function appendAndBroadcastAccountRunRecord(status, state) {
  events.push({ status, state });
}
${extractFunction('attachRecoveredAutoRunOutcome')}
${extractFunction('runCompletedStepSideEffects')}
${extractFunction('reportCompletedStepSideEffectError')}
${extractFunction('completeStepFromBackground')}
return { completeStepFromBackground };
`)(events);

  await api.completeStepFromBackground(10, {});
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(events.length, 1);
  assert.equal(events[0].status, 'success');
  assert.equal(events[0].state.recoveredSuccess, true);
  assert.deepStrictEqual(events[0].state.recoveredFailureReasons, ['STEP3_PAGE_COMM_TIMEOUT::timeout']);
});
