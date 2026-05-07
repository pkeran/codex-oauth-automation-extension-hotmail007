const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/signup-page.js', 'utf8');

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

const bundle = extractFunction('step6SwitchToOneTimeCodeLogin');

function createApi() {
  return new Function(`
${bundle}
return { step6SwitchToOneTimeCodeLogin };
`)();
}

function cleanupGlobals() {
  delete globalThis.findOneTimeCodeLoginTrigger;
  delete globalThis.isActionEnabled;
  delete globalThis.log;
  delete globalThis.humanPause;
  delete globalThis.simulateClick;
  delete globalThis.sleep;
  delete globalThis.waitForStep6SwitchTransition;
  delete globalThis.finalizeStep6VerificationReady;
  delete globalThis.step6LoginFromPasswordPage;
  delete globalThis.step6LoginFromPhonePage;
  delete globalThis.step6LoginFromEmailPage;
  delete globalThis.createStep6RecoverableResult;
  delete globalThis.getLoginAuthStateLabel;
  delete globalThis.normalizeStep6Snapshot;
  delete globalThis.inspectLoginAuthState;
}

test('step6SwitchToOneTimeCodeLogin returns recoverable when switch lands back on password page', async () => {
  const api = createApi();
  const logs = [];
  const snapshot = {
    state: 'password_page',
    switchTrigger: { id: 'otp' },
  };

  globalThis.findOneTimeCodeLoginTrigger = () => snapshot.switchTrigger;
  globalThis.isActionEnabled = () => true;
  globalThis.log = (message, level = 'info', options = {}) => {
    logs.push({ message, level, step: options.step, stepKey: options.stepKey });
  };
  globalThis.humanPause = async () => {};
  globalThis.simulateClick = () => {};
  globalThis.sleep = async () => {};
  globalThis.waitForStep6SwitchTransition = async () => ({
    action: 'password',
    snapshot: {
      state: 'password_page',
      url: 'https://auth.openai.com/log-in/password',
    },
  });
  globalThis.finalizeStep6VerificationReady = async () => {
    throw new Error('should not finalize verification when switch falls back to password page');
  };
  globalThis.step6LoginFromPasswordPage = async () => {
    throw new Error('should not recurse back into password flow after OTP switch fallback');
  };
  globalThis.step6LoginFromPhonePage = async () => {
    throw new Error('should not branch into phone flow after OTP switch fallback');
  };
  globalThis.step6LoginFromEmailPage = async () => {
    throw new Error('should not branch into email flow after OTP switch fallback');
  };
  globalThis.createStep6RecoverableResult = (reason, stateSnapshot, details) => ({
    step6Outcome: 'recoverable',
    reason,
    stateSnapshot,
    ...details,
  });
  globalThis.getLoginAuthStateLabel = (stateSnapshot) => stateSnapshot?.state === 'password_page' ? '密码页' : '未知页面';
  globalThis.normalizeStep6Snapshot = (value) => value;
  globalThis.inspectLoginAuthState = () => snapshot;

  try {
    const result = await api.step6SwitchToOneTimeCodeLogin({ visibleStep: 7 }, snapshot);

    assert.deepStrictEqual(result, {
      step6Outcome: 'recoverable',
      reason: 'one_time_code_switch_unexpected_state',
      stateSnapshot: {
        state: 'password_page',
        url: 'https://auth.openai.com/log-in/password',
      },
      message: '点击一次性验证码登录后页面进入密码页，请回到步骤 7 重新开始登录。',
      loginVerificationRequestedAt: null,
    });
    assert.equal(logs.some(({ message }) => /已点击一次性验证码登录/.test(message)), true);
  } finally {
    cleanupGlobals();
  }
});
