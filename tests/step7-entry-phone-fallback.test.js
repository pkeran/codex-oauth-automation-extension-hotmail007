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

test('step6OpenLoginEntry falls back to generic login trigger in phone mode before switching to phone login', async () => {
  const api = new Function(`
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('step6OpenLoginEntry')}

const calls = [];
const genericLoginTrigger = {
  label: '登录',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-disabled') return 'false';
    return '';
  },
};

function inspectLoginAuthState() {
  return { state: 'entry_page' };
}

function findLoginEntryTrigger() {
  return genericLoginTrigger;
}

function findLoginPhoneEntryTrigger() {
  return null;
}

function isActionEnabled(element) {
  return Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
}

function getActionText(element) {
  return String(element?.label || '');
}

async function humanPause() {}

function simulateClick(element) {
  calls.push({ type: 'click', target: getActionText(element) });
}

async function waitForLoginEntryOpenTransition() {
  return { state: 'email_page' };
}

async function switchFromEmailPageToPhoneLogin(payload, snapshot) {
  calls.push({ type: 'switch', payload, snapshot });
  return { branch: 'switch-to-phone', state: snapshot.state };
}

async function step6LoginFromEmailPage(payload, snapshot) {
  calls.push({ type: 'email', payload, snapshot });
  return { branch: 'email', state: snapshot.state };
}

async function step6LoginFromPasswordPage(payload, snapshot) {
  calls.push({ type: 'password', payload, snapshot });
  return { branch: 'password', state: snapshot.state };
}

async function step6LoginFromPhonePage(payload, snapshot) {
  calls.push({ type: 'phone', payload, snapshot });
  return { branch: 'phone', state: snapshot.state };
}

function continueFromExistingSessionSelectPage(payload, snapshot) {
  calls.push({ type: 'existing-session', payload, snapshot });
  return { branch: 'existing-session', state: snapshot.state };
}

function finalizeStep6VerificationReady(options) {
  return { branch: 'verification', via: options?.via || '' };
}

function createStep6OAuthConsentSuccessResult(snapshot) {
  return { branch: 'consent', state: snapshot.state };
}

function createStep6AddEmailSuccessResult(snapshot) {
  return { branch: 'add-email', state: snapshot.state };
}

async function createStep6LoginTimeoutRecoveryTransition() {
  return { action: 'recoverable', result: { code: 'timeout' } };
}

function createStep6RecoverableResult(code, snapshot, extra = {}) {
  return { recoverable: true, code, snapshot, ...extra };
}

function log() {}

return {
  async run() {
    return step6OpenLoginEntry(
      {
        email: 'user@example.com',
        phoneNumber: '66959916439',
        loginIdentifierType: 'phone',
        visibleStep: 7,
      },
      {
        state: 'entry_page',
        loginEntryTrigger: genericLoginTrigger,
        phoneEntryTrigger: null,
      }
    );
  },
  getCalls() {
    return calls.slice();
  },
};
`)();

  const result = await api.run();
  const calls = api.getCalls();

  assert.deepEqual(result, {
    branch: 'switch-to-phone',
    state: 'email_page',
  });
  assert.deepEqual(calls, [
    { type: 'click', target: '登录' },
    {
      type: 'switch',
      payload: {
        email: 'user@example.com',
        phoneNumber: '66959916439',
        loginIdentifierType: 'phone',
        visibleStep: 7,
      },
      snapshot: { state: 'email_page' },
    },
  ]);
});
