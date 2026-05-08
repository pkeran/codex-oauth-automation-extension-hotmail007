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

function extractConst(name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(/[^\\n]+/[a-z]*)\\s*;`));
  if (!match) {
    throw new Error(`missing const ${name}`);
  }
  return `const ${name} = ${match[1]};`;
}

test('step7 phone mode treats mixed log-in page as email page and switches to phone login', async () => {
  const api = new Function(`
${extractConst('LOGIN_PHONE_ENTRY_PAGE_PATTERN')}
${extractFunction('getPageTextSnapshot')}
${extractFunction('isLoginPhoneUsernameKind')}
${extractFunction('isLoginPhoneEntryPageText')}
${extractFunction('getLoginInputAttributeText')}
${extractFunction('isLoginEmailLikeInput')}
${extractFunction('getLoginEmailInput')}
${extractFunction('inspectLoginAuthState')}
${extractFunction('normalizeStep6Snapshot')}
${extractFunction('step6_login')}

const calls = [];
const location = {
  href: 'https://auth.openai.com/log-in',
  pathname: '/log-in',
};

const emailInput = {
  type: 'email',
  name: 'username',
  id: 'login-email',
  placeholder: 'Email address',
  getAttribute(name) {
    if (name === 'type') return this.type;
    if (name === 'name') return this.name;
    if (name === 'id') return this.id;
    if (name === 'placeholder') return this.placeholder;
    return '';
  },
};

const document = {
  body: {
    innerText: 'Welcome back Email address Continue with phone number Continue with Google',
    textContent: 'Welcome back Email address Continue with phone number Continue with Google',
  },
  querySelector(selector) {
    if (String(selector || '').includes('input[type="email"]')) {
      return emailInput;
    }
    return null;
  },
  querySelectorAll(selector) {
    if (String(selector || '').includes('input[type="email"]')) {
      return [emailInput];
    }
    return [];
  },
};

function getLoginTimeoutErrorPageState() { return null; }
function getVerificationCodeTarget() { return null; }
function getLoginPasswordInput() { return null; }
function getLoginPhoneInput() { return null; }
function getLoginVerificationDisplayedEmail() { return ''; }
function getPhoneVerificationDisplayedPhone() { return ''; }
function findOneTimeCodeLoginTrigger() { return null; }
function findLoginEntryTrigger() { return null; }
function findLoginPhoneEntryTrigger() { return null; }
function findLoginMoreOptionsTrigger() { return null; }
function getLoginSubmitButton() { return { id: 'submit' }; }
function isVerificationPageStillVisible() { return false; }
function isAddPhonePageReady() { return false; }
function isAddEmailPageReady() { return false; }
function isPhoneVerificationPageReady() { return false; }
function isStep8Ready() { return false; }
function isOAuthConsentPage() { return false; }
function getExistingSessionSelectSnapshot() { return null; }
function isVisibleElement() { return true; }
function isActionEnabled() { return true; }

async function waitForKnownLoginAuthState() {
  return inspectLoginAuthState();
}

async function switchFromEmailPageToPhoneLogin(payload, snapshot) {
  calls.push({ type: 'switch', payload, snapshot });
  return { branch: 'switch-to-phone', state: snapshot.state };
}

async function step6LoginFromEmailPage(payload, snapshot) {
  calls.push({ type: 'email', payload, snapshot });
  return { branch: 'email', state: snapshot.state };
}

async function step6LoginFromPhonePage(payload, snapshot) {
  calls.push({ type: 'phone', payload, snapshot });
  return { branch: 'phone', state: snapshot.state };
}

async function step6LoginFromPasswordPage(payload, snapshot) {
  calls.push({ type: 'password', payload, snapshot });
  return { branch: 'password', state: snapshot.state };
}

async function step6OpenLoginEntry(payload, snapshot) {
  calls.push({ type: 'entry', payload, snapshot });
  return { branch: 'entry', state: snapshot.state };
}

function continueFromExistingSessionSelectPage(payload, snapshot) {
  calls.push({ type: 'existing-session', payload, snapshot });
  return { branch: 'existing-session', state: snapshot.state };
}

function createStep6RecoverableResult() {
  return { recoverable: true };
}

function createStep6OAuthConsentSuccessResult(snapshot) {
  return { branch: 'consent', state: snapshot.state };
}

function createStep6AddEmailSuccessResult(snapshot) {
  return { branch: 'add-email', state: snapshot.state };
}

function finalizeStep6VerificationReady(options) {
  return { branch: 'verification', via: options?.via || '' };
}

function throwForStep6FatalState(snapshot) {
  throw new Error('fatal:' + String(snapshot?.state || 'unknown'));
}

function log() {}

return {
  run() {
    return step6_login({
      email: 'user@example.com',
      phoneNumber: '66959916439',
      loginIdentifierType: 'phone',
      visibleStep: 7,
    });
  },
  getCalls() {
    return calls.slice();
  },
};
`)();

  const result = await api.run();

  assert.deepEqual(result, {
    branch: 'switch-to-phone',
    state: 'email_page',
  });
  assert.equal(api.getCalls().length, 1);
  assert.equal(api.getCalls()[0].type, 'switch');
  assert.equal(api.getCalls()[0].snapshot.state, 'email_page');
});
