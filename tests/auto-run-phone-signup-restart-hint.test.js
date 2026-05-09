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

const bundle = [
  extractFunction('isRestartCurrentAttemptError'),
  extractFunction('isAddPhoneAuthFailure'),
  extractFunction('isAddPhoneAuthUrl'),
  extractFunction('isAddPhoneAuthState'),
  extractFunction('getPostStep6AutoRestartDecision'),
  extractFunction('runAutoSequenceFromStep'),
].join('\n');

function createHarness(options = {}) {
  const {
    failureStep = 5,
    failureMessage = 'generic failure after step4 success',
    failureCode = '',
  } = options;

  return new Function(`
const AUTO_STEP_DELAYS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
const LAST_STEP_ID = 10;
const FINAL_OAUTH_CHAIN_START_STEP = 7;
const SIGNUP_METHOD_PHONE = 'phone';
const LOG_PREFIX = '[test]';
const chrome = {
  tabs: { update: async () => {} },
};

const state = {
  stepStatuses: { 1: 'completed', 2: 'completed', 3: 'completed', 4: 'completed' },
  signupMethod: 'phone',
  resolvedSignupMethod: 'phone',
  signupPhoneNumber: '+6612345',
  signupPhoneCompletedActivation: {
    activationId: 'signup-done',
    phoneNumber: '+6612345',
    costOutcome: 'consumed',
  },
};

async function addLog() {}
async function ensureAutoEmailReady() {}
async function ensureResolvedSignupMethodForRun() { return 'phone'; }
async function broadcastAutoRunStatus() {}
async function getState() { return state; }
function getStepIdsForState() { return [1,2,3,4,5,6,7,8,9,10]; }
function getStepDefinitionForState(step) {
  const map = {
    1: { key: 'open-signup' },
    2: { key: 'prepare-email' },
    3: { key: 'fill-password' },
    4: { key: 'verify-email' },
    5: { key: 'fill-profile' },
    6: { key: 'wait-registration-success' },
    7: { key: 'oauth-login' },
    8: { key: 'fetch-login-code' },
    9: { key: 'confirm-oauth' },
    10: { key: 'platform-verify' },
  };
  return map[Number(step)] || null;
}
function getStepExecutionKeyForState(step, state = {}) {
  return String(getStepDefinitionForState(step, state)?.key || '').trim();
}
function isStopError() { return false; }
function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}
async function executeStepAndWait(step) {
  if (step === ${JSON.stringify(failureStep)}) {
    const error = new Error(${JSON.stringify(failureMessage)});
    if (${JSON.stringify(failureCode)}) {
      error.code = ${JSON.stringify(failureCode)};
    }
    throw error;
  }
}
async function getTabId() { return null; }
async function invalidateDownstreamAfterStepRestart() {}
function getLoginAuthStateLabel(state) { return state || 'unknown'; }
function getErrorMessage(error) { return error?.message || String(error || ''); }
function isPhoneSmsPlatformRateLimitFailure() { return false; }
async function getLoginAuthStateFromContent() { return { state: 'unknown', url: '' }; }

${bundle}

return {
  async runAndCaptureError() {
    try {
      await runAutoSequenceFromStep(1, {
        targetRun: 1,
        totalRuns: 1,
        attemptRuns: 1,
        continued: false,
      });
      return null;
    } catch (error) {
      return error;
    }
  },
};
`)();
}

test('runAutoSequenceFromStep annotates generic step 5 failure with phone-signup fresh-attempt resume hint', async () => {
  const harness = createHarness({ failureStep: 5 });
  const error = await harness.runAndCaptureError();
  assert.equal(error?.phoneSignupFreshAttemptResumeStep, 5);
});

test('runAutoSequenceFromStep annotates generic step 6 failure with phone-signup fresh-attempt resume hint', async () => {
  const harness = createHarness({ failureStep: 6 });
  const error = await harness.runAndCaptureError();
  assert.equal(error?.phoneSignupFreshAttemptResumeStep, 6);
});
