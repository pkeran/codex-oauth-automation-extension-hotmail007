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
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      parenDepth += 1;
    } else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (char === '{' && signatureEnded) {
      braceStart = index;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const char = source[end];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

function createExistingSessionApi() {
  return new Function(`
const logs = [];
const clicks = [];
let currentState = 'existing_session_select_page';

const location = {
  href: 'https://auth.openai.com/log-in',
  pathname: '/log-in',
};

function createButton(label, phone, sessionId) {
  return {
    textContent: label + ' ' + phone,
    innerText: label + ' ' + phone,
    value: sessionId,
    disabled: false,
    hidden: false,
    attributes: {
      name: 'session_id',
      value: sessionId,
      'data-dd-action-name': 'Select existing session',
      'aria-label': '选择帐户 ' + label + ' ' + phone,
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : '';
    },
  };
}

const firstButton = createButton('Matthew Martinez', '+56 9 5123 4567', 'session-1');
const secondButton = createButton('Target User', '+56 9 5467 3883', 'session-2');
const passwordInput = { id: 'password' };

const document = {
  body: {
    get innerText() {
      if (currentState === 'existing_session_select_page') {
        return '选择帐户 Matthew Martinez +56 9 5123 4567 Target User +56 9 5467 3883 登录至另一个帐户 创建帐户';
      }
      if (currentState === 'password_page') {
        return '输入密码';
      }
      return '';
    },
    get textContent() {
      return this.innerText;
    },
  },
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    const text = String(selector || '');
    if (
      currentState === 'existing_session_select_page'
      && (
        text.includes('button')
        || text.includes('[role="button"]')
        || text.includes('input[type="button"]')
        || text.includes('input[type="submit"]')
      )
    ) {
      return [firstButton, secondButton];
    }
    return [];
  },
};

function getLoginTimeoutErrorPageState() {
  return null;
}

function getVerificationCodeTarget() {
  return null;
}

function getLoginPasswordInput() {
  return currentState === 'password_page' ? passwordInput : null;
}

function getLoginEmailInput() {
  return null;
}

function getLoginPhoneInput() {
  return null;
}

function findOneTimeCodeLoginTrigger() {
  return null;
}

function findLoginEntryTrigger() {
  return null;
}

function findLoginPhoneEntryTrigger() {
  return null;
}

function findLoginMoreOptionsTrigger() {
  return null;
}

function getLoginSubmitButton() {
  return null;
}

function isVerificationPageStillVisible() {
  return false;
}

function isAddPhonePageReady() {
  return false;
}

function isAddEmailPageReady() {
  return false;
}

function isPhoneVerificationPageReady() {
  return false;
}

function isStep8Ready() {
  return false;
}

function isOAuthConsentPage() {
  return false;
}

function getLoginVerificationDisplayedEmail() {
  return '';
}

function getPhoneVerificationDisplayedPhone() {
  return '';
}

function isVisibleElement(element) {
  return Boolean(element) && !element.hidden;
}

function isActionEnabled(element) {
  return Boolean(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
}

function simulateClick(target) {
  clicks.push(target.textContent);
  if (target === secondButton) {
    currentState = 'password_page';
  }
}

async function sleep() {}
async function humanPause() {}
function throwIfStopped() {}

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function step6LoginFromPasswordPage(payload, snapshot) {
  return {
    branch: 'password',
    payload,
    snapshot,
  };
}

function throwForStep6FatalState(snapshot) {
  throw new Error('fatal:' + String(snapshot?.state || 'unknown'));
}

${extractFunction('getPageTextSnapshot')}
${extractFunction('getActionText')}
${extractFunction('normalizePhoneDigits')}
${extractFunction('getExistingSessionButtonVisibleText')}
${extractFunction('extractExistingSessionButtonPhoneDigits')}
${extractFunction('collectExistingSessionButtons')}
${extractFunction('getExistingSessionSelectSnapshot')}
${extractFunction('inspectLoginAuthState')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('waitForKnownLoginAuthState')}
${extractFunction('createStep6RecoverableResult')}
${extractFunction('waitForExistingSessionSelectTransition')}
${extractFunction('continueFromExistingSessionSelectPage')}
${extractFunction('step6_login')}

return {
  run() {
    return step6_login({
      phoneNumber: '56954673883',
      loginIdentifierType: 'phone',
      visibleStep: 7,
    });
  },
  runNoMatch() {
    return continueFromExistingSessionSelectPage(
      {
        phoneNumber: '56999999999',
        loginIdentifierType: 'phone',
        visibleStep: 7,
      },
      inspectLoginAuthState()
    );
  },
  snapshot() {
    return {
      clicks: clicks.slice(),
      logs: logs.slice(),
      currentState,
    };
  },
};
`)();
}

test('step 7 clicks the existing-session card that matches the current phone number', async () => {
  const api = createExistingSessionApi();

  const result = await api.run();
  const snapshot = api.snapshot();

  assert.equal(result.branch, 'password');
  assert.equal(result.snapshot.state, 'password_page');
  assert.deepEqual(snapshot.clicks, ['Target User +56 9 5467 3883']);
  assert.equal(snapshot.currentState, 'password_page');
});

test('step 7 existing-session selection does not click a non-matching phone card', async () => {
  const api = createExistingSessionApi();

  const result = await api.runNoMatch();
  const snapshot = api.snapshot();

  assert.equal(result.step6Outcome, 'recoverable');
  assert.equal(result.reason, 'existing_session_select_no_matching_phone');
  assert.deepEqual(snapshot.clicks, []);
  assert.equal(snapshot.currentState, 'existing_session_select_page');
});
