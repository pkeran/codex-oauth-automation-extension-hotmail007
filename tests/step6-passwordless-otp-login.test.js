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

const bundle = extractFunction('step6LoginFromPasswordPage');

function createApi() {
  return new Function(`
${bundle}
return { step6LoginFromPasswordPage };
`)();
}

function cleanupGlobals() {
  delete globalThis.normalizeStep6Snapshot;
  delete globalThis.inspectLoginAuthState;
  delete globalThis.log;
  delete globalThis.step6SwitchToOneTimeCodeLogin;
  delete globalThis.createStep6RecoverableResult;
  delete globalThis.fillInput;
  delete globalThis.humanPause;
  delete globalThis.sleep;
  delete globalThis.triggerLoginSubmitAction;
  delete globalThis.waitForStep6PasswordSubmitTransition;
}

test('step6LoginFromPasswordPage switches to one-time-code login when password is missing but switch trigger exists', async () => {
  const api = createApi();
  const logs = [];
  const snapshot = {
    state: 'password_page',
    passwordInput: { id: 'password' },
    switchTrigger: { id: 'otp' },
  };

  globalThis.normalizeStep6Snapshot = (value) => value;
  globalThis.inspectLoginAuthState = () => snapshot;
  globalThis.log = (message, level = 'info', options = {}) => {
    logs.push({ message, level, step: options.step, stepKey: options.stepKey });
  };
  globalThis.step6SwitchToOneTimeCodeLogin = async (payload, value) => {
    assert.deepStrictEqual(payload, { email: 'user@example.com', password: '' });
    assert.strictEqual(value, snapshot);
    return { step6Outcome: 'success', via: 'switch_to_one_time_code_login' };
  };
  globalThis.createStep6RecoverableResult = () => {
    throw new Error('should not create recoverable result when switch trigger exists');
  };
  globalThis.fillInput = () => {
    throw new Error('should not fill password when password is missing');
  };
  globalThis.humanPause = async () => {};
  globalThis.sleep = async () => {};
  globalThis.triggerLoginSubmitAction = async () => {};
  globalThis.waitForStep6PasswordSubmitTransition = async () => {
    throw new Error('should not submit password when password is missing');
  };

  try {
    const result = await api.step6LoginFromPasswordPage({ email: 'user@example.com', password: '' }, snapshot);

    assert.deepStrictEqual(result, { step6Outcome: 'success', via: 'switch_to_one_time_code_login' });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].level, 'warn');
    assert.equal(logs[0].step, 7);
    assert.equal(logs[0].stepKey, 'oauth-login');
  } finally {
    cleanupGlobals();
  }
});

test('step6LoginFromPasswordPage returns a recoverable result when password is missing and no one-time-code trigger exists', async () => {
  const api = createApi();
  const snapshot = {
    state: 'password_page',
    passwordInput: { id: 'password' },
    switchTrigger: null,
  };

  globalThis.normalizeStep6Snapshot = (value) => value;
  globalThis.inspectLoginAuthState = () => snapshot;
  globalThis.log = () => {};
  globalThis.step6SwitchToOneTimeCodeLogin = async () => {
    throw new Error('should not switch without a one-time-code trigger');
  };
  globalThis.createStep6RecoverableResult = (reason, stateSnapshot, details) => ({
    step6Outcome: 'recoverable',
    reason,
    stateSnapshot,
    ...details,
  });
  globalThis.fillInput = () => {
    throw new Error('should not fill password when password is missing');
  };
  globalThis.humanPause = async () => {};
  globalThis.sleep = async () => {};
  globalThis.triggerLoginSubmitAction = async () => {};
  globalThis.waitForStep6PasswordSubmitTransition = async () => {
    throw new Error('should not submit password when password is missing');
  };

  try {
    const result = await api.step6LoginFromPasswordPage({ email: 'user@example.com', password: '' }, snapshot);

    assert.equal(result.step6Outcome, 'recoverable');
    assert.equal(result.reason, 'missing_password_and_one_time_code_trigger');
    assert.strictEqual(result.stateSnapshot, snapshot);
  } finally {
    cleanupGlobals();
  }
});

test('step6LoginFromPasswordPage switches to OTP when invalid-credential page still exposes switch trigger', async () => {
  const api = createApi();
  const logs = [];
  const snapshot = {
    state: 'login_password_invalid',
    passwordInput: { id: 'password' },
    switchTrigger: { id: 'otp' },
    errorText: 'Incorrect email address or password',
    url: 'https://auth.openai.com/log-in/password',
  };

  globalThis.normalizeStep6Snapshot = (value) => value;
  globalThis.inspectLoginAuthState = () => snapshot;
  globalThis.log = (message, level = 'info', options = {}) => {
    logs.push({ message, level, step: options.step, stepKey: options.stepKey });
  };
  globalThis.step6SwitchToOneTimeCodeLogin = async (payload, value) => {
    assert.deepStrictEqual(payload, { email: 'user@example.com', password: 'secret' });
    assert.strictEqual(value, snapshot);
    return {
      step6Outcome: 'recoverable',
      reason: 'one_time_code_switch_unexpected_state',
      via: 'switch_to_one_time_code_login',
    };
  };
  globalThis.createStep6RecoverableResult = () => {
    throw new Error('should prefer OTP switch over returning login_password_invalid directly when switch trigger exists');
  };
  globalThis.fillInput = () => {
    throw new Error('should not fill password again on invalid-credential page');
  };
  globalThis.humanPause = async () => {};
  globalThis.sleep = async () => {};
  globalThis.triggerLoginSubmitAction = async () => {
    throw new Error('should not resubmit password on invalid-credential page');
  };
  globalThis.waitForStep6PasswordSubmitTransition = async () => {
    throw new Error('should not wait for password submit transition on invalid-credential page');
  };

  try {
    const result = await api.step6LoginFromPasswordPage({ email: 'user@example.com', password: 'secret' }, snapshot);

    assert.deepStrictEqual(result, {
      step6Outcome: 'recoverable',
      reason: 'one_time_code_switch_unexpected_state',
      via: 'switch_to_one_time_code_login',
    });
    assert.equal(logs.some(({ level, stepKey }) => level === 'warn' && stepKey === 'oauth-login'), true);
  } finally {
    cleanupGlobals();
  }
});

test('step6LoginFromPasswordPage returns login_password_invalid recoverable when invalid-credential page has no switch trigger', async () => {
  const api = createApi();
  const snapshot = {
    state: 'login_password_invalid',
    passwordInput: { id: 'password' },
    switchTrigger: null,
    errorText: 'Incorrect email address or password',
    url: 'https://auth.openai.com/log-in/password',
  };

  globalThis.normalizeStep6Snapshot = (value) => value;
  globalThis.inspectLoginAuthState = () => snapshot;
  globalThis.log = () => {};
  globalThis.step6SwitchToOneTimeCodeLogin = async () => {
    throw new Error('should not switch when OTP entry is unavailable');
  };
  globalThis.createStep6RecoverableResult = (reason, stateSnapshot, details) => ({
    step6Outcome: 'recoverable',
    reason,
    stateSnapshot,
    ...details,
  });
  globalThis.fillInput = () => {
    throw new Error('should not fill password again on invalid-credential page');
  };
  globalThis.humanPause = async () => {};
  globalThis.sleep = async () => {};
  globalThis.triggerLoginSubmitAction = async () => {
    throw new Error('should not resubmit password on invalid-credential page');
  };
  globalThis.waitForStep6PasswordSubmitTransition = async () => {
    throw new Error('should not wait for password submit transition on invalid-credential page');
  };

  try {
    const result = await api.step6LoginFromPasswordPage({ email: 'user@example.com', password: 'secret' }, snapshot);

    assert.equal(result.step6Outcome, 'recoverable');
    assert.equal(result.reason, 'login_password_invalid');
    assert.strictEqual(result.stateSnapshot, snapshot);
  } finally {
    cleanupGlobals();
  }
});
