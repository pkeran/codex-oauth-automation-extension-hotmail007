const assert = require('assert');
const fs = require('fs');

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

const bundle = [
  extractFunction('getPageTextSnapshot'),
  extractFunction('normalizePhoneDigits'),
  extractFunction('getLoginVerificationDisplayedEmail'),
  extractFunction('getPhoneVerificationDisplayedPhone'),
  extractFunction('isPhoneVerificationPageReady'),
  extractFunction('getExistingSessionButtonVisibleText'),
  extractFunction('extractExistingSessionButtonPhoneDigits'),
  extractFunction('collectExistingSessionButtons'),
  extractFunction('getExistingSessionSelectSnapshot'),
  extractFunction('inspectLoginAuthState'),
  extractFunction('normalizeStep6Snapshot'),
].join('\n');

function createApi(overrides = {}) {
  return new Function(`
const location = {
  href: ${JSON.stringify(overrides.href || 'https://auth.openai.com/log-in')},
  pathname: ${JSON.stringify(overrides.pathname || '/log-in')},
};

const actionDescriptors = ${JSON.stringify(overrides.actions || [])};
const actions = actionDescriptors.map((descriptor) => ({
  textContent: descriptor.textContent || '',
  innerText: descriptor.innerText || descriptor.textContent || '',
  value: descriptor.value || '',
  disabled: Boolean(descriptor.disabled),
  hidden: Boolean(descriptor.hidden),
  attributes: descriptor.attributes || {},
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : '';
  },
}));

const document = {
  body: {
    innerText: ${JSON.stringify(overrides.pageText || '')},
    textContent: ${JSON.stringify(overrides.pageText || '')},
  },
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    const text = String(selector || '');
    if (
      text.includes('button')
      || text.includes('[role="button"]')
      || text.includes('input[type="button"]')
      || text.includes('input[type="submit"]')
    ) {
      return actions;
    }
    return [];
  },
};

function getLoginTimeoutErrorPageState() {
  return ${JSON.stringify(overrides.retryState || null)};
}

function getVerificationCodeTarget() {
  return ${JSON.stringify(overrides.verificationTarget || null)};
}

function getLoginPasswordInput() {
  return ${JSON.stringify(overrides.passwordInput || null)};
}

function getLoginEmailInput() {
  return ${JSON.stringify(overrides.emailInput || null)};
}

function getLoginPhoneInput() {
  return ${JSON.stringify(overrides.phoneInput || null)};
}

function findOneTimeCodeLoginTrigger() {
  return ${JSON.stringify(overrides.switchTrigger || null)};
}

function findLoginEntryTrigger() {
  return ${JSON.stringify(overrides.loginEntryTrigger || null)};
}

function findLoginPhoneEntryTrigger() {
  return ${JSON.stringify(overrides.phoneEntryTrigger || null)};
}

function findLoginMoreOptionsTrigger() {
  return ${JSON.stringify(overrides.moreOptionsTrigger || null)};
}

function getLoginSubmitButton() {
  return ${JSON.stringify(overrides.submitButton || null)};
}

function isVerificationPageStillVisible() {
  return ${JSON.stringify(Boolean(overrides.verificationVisible))};
}

function isAddPhonePageReady() {
  return ${JSON.stringify(Boolean(overrides.addPhonePage))};
}

function isAddEmailPageReady() {
  return ${JSON.stringify(Boolean(overrides.addEmailPage))};
}

function isVisibleElement() {
  return true;
}

function isActionEnabled(element) {
  return Boolean(element)
    && !element.disabled
    && element.getAttribute('aria-disabled') !== 'true';
}

function isStep8Ready() {
  return ${JSON.stringify(Boolean(overrides.consentReady))};
}

function isOAuthConsentPage() {
  return ${JSON.stringify(Boolean(overrides.oauthConsentPage))};
}

${bundle}

return {
  inspectLoginAuthState,
  isPhoneVerificationPageReady,
  normalizeStep6Snapshot,
};
`)();
}

{
  const api = createApi({
    emailInput: { id: 'email' },
    submitButton: { id: 'submit' },
    oauthConsentPage: true,
    consentReady: true,
  });

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(
    snapshot.state,
    'email_page',
    '第六步在 /log-in 页应优先识别为邮箱页'
  );
}

{
  const api = createApi({
    verificationTarget: { id: 'otp' },
    pageText: 'We emailed a code to display.user@example.com. Enter it below.',
  });

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(snapshot.displayedEmail, 'display.user@example.com');
}

{
  const api = createApi({
    pathname: '/email-verification',
    href: 'https://auth.openai.com/email-verification',
    verificationTarget: { id: 'otp' },
    pageText: 'We just sent to display.user@example.com. Enter it below.',
  });

  assert.strictEqual(
    api.isPhoneVerificationPageReady(),
    false,
    '邮箱验证码页不应被误判为手机验证码页'
  );

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(snapshot.state, 'verification_page');
}

{
  const api = createApi({
    pathname: '/phone-verification',
    href: 'https://auth.openai.com/phone-verification',
    verificationTarget: { id: 'otp' },
    pageText: 'Check your phone. We just sent a code to +66 81 234 5678.',
  });

  assert.strictEqual(api.isPhoneVerificationPageReady(), true);

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(snapshot.state, 'phone_verification_page');
}

{
  const api = createApi({
    pathname: '/email-verification',
    retryState: {
      retryEnabled: true,
      titleMatched: false,
      detailMatched: false,
      routeErrorMatched: true,
    },
    verificationTarget: { id: 'otp' },
    verificationVisible: true,
  });

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(
    snapshot.state,
    'login_timeout_error_page',
    '第七步在 /email-verification 的登录重试页应优先识别为登录超时报错页'
  );
}

{
  const api = createApi({
    oauthConsentPage: true,
    consentReady: true,
  });

  const inspected = api.inspectLoginAuthState();
  assert.strictEqual(inspected.state, 'oauth_consent_page');

  const snapshot = api.normalizeStep6Snapshot({
    state: 'oauth_consent_page',
    url: 'https://auth.openai.com/authorize',
  });

  assert.strictEqual(snapshot.state, 'oauth_consent_page', '第六步应保留 oauth_consent_page 状态');
}

{
  const api = createApi({
    loginEntryTrigger: { id: 'continue-email' },
  });

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(snapshot.state, 'entry_page');
}

{
  const api = createApi({
    phoneInput: { id: 'phone' },
    submitButton: { id: 'submit' },
  });

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(snapshot.state, 'phone_entry_page');
}

{
  const api = createApi({
    href: 'https://auth.openai.com/log-in',
    pathname: '/log-in',
    pageText: '欢迎回来 电子邮件地址 使用电话号码继续 使用 Google 账户继续',
    emailInput: { id: 'email', type: 'email', name: 'username' },
    submitButton: { id: 'submit' },
  });

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(
    snapshot.state,
    'email_page',
    '混合登录页存在可见邮箱输入框时，应优先识别为 email_page，而不是 unknown/phone_entry_page'
  );
}

{
  const api = createApi({
    pathname: '/add-email',
    href: 'https://auth.openai.com/add-email',
    emailInput: { id: 'email' },
    submitButton: { id: 'submit' },
    addEmailPage: true,
  });

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(snapshot.state, 'add_email_page');
  assert.strictEqual(snapshot.addEmailPage, true);
}

{
  const api = createApi({
    passwordInput: { id: 'password' },
    switchTrigger: { id: 'otp' },
    pageText: 'Incorrect email address or password',
  });

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(snapshot.state, 'login_password_invalid');
  assert.match(String(snapshot.errorText || ''), /Incorrect email address or password/i);
}

{
  const api = createApi({
    pageText: '选择帐户 Matthew Martinez +56 9 5467 3883 登录至另一个帐户 创建帐户',
    actions: [
      {
        textContent: '选择帐户 Matthew Martinez +56 9 5467 3883',
        attributes: {
          name: 'session_id',
          'data-dd-action-name': 'Select existing session',
        },
      },
    ],
  });

  const snapshot = api.inspectLoginAuthState();
  assert.strictEqual(snapshot.state, 'existing_session_select_page');
}

assert.ok(
  extractFunction('inspectLoginAuthState').includes("state: 'oauth_consent_page'"),
  'inspectLoginAuthState 应产出 oauth_consent_page 状态'
);

assert.ok(
  extractFunction('inspectLoginAuthState').includes("state: 'phone_entry_page'"),
  'inspectLoginAuthState 应产出 phone_entry_page 状态'
);

assert.ok(
  extractFunction('inspectLoginAuthState').includes("state: 'add_email_page'"),
  'inspectLoginAuthState 应产出 add_email_page 状态'
);

assert.ok(
  extractFunction('inspectLoginAuthState').includes("state: 'existing_session_select_page'"),
  'inspectLoginAuthState should produce existing_session_select_page state'
);

function createMixedLoginStateApi() {
  return new Function(`
${extractConst('LOGIN_PHONE_ENTRY_PAGE_PATTERN')}
${extractFunction('getPageTextSnapshot')}
${extractFunction('isLoginPhoneUsernameKind')}
${extractFunction('isLoginPhoneEntryPageText')}
${extractFunction('getLoginInputAttributeText')}
${extractFunction('isLoginEmailLikeInput')}
${extractFunction('getLoginEmailInput')}
${extractFunction('inspectLoginAuthState')}

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

return {
  isLoginPhoneEntryPageText,
  getLoginEmailInput,
  inspectLoginAuthState,
};
`)();
}

{
  const api = createMixedLoginStateApi();
  assert.strictEqual(Boolean(api.isLoginPhoneEntryPageText()), true);
  assert.ok(api.getLoginEmailInput(), 'mixed log-in page should keep the visible email input');
  assert.strictEqual(
    api.inspectLoginAuthState().state,
    'email_page',
    'mixed log-in page should resolve to email_page instead of unknown'
  );
}

function createAmbiguousMixedLoginStateApi() {
  return new Function(`
${extractConst('LOGIN_PHONE_ENTRY_PAGE_PATTERN')}
${extractFunction('getPageTextSnapshot')}
${extractFunction('isLoginPhoneUsernameKind')}
${extractFunction('isLoginPhoneEntryPageText')}
${extractFunction('getLoginInputAttributeText')}
${extractFunction('isLoginEmailLikeInput')}
${extractFunction('getLoginEmailInput')}

const location = {
  href: 'https://auth.openai.com/log-in',
  pathname: '/log-in',
};

const genericUsernameInput = {
  type: 'text',
  name: 'username',
  id: 'login-username',
  autocomplete: 'username',
  placeholder: '',
  getAttribute(name) {
    if (name === 'type') return this.type;
    if (name === 'name') return this.name;
    if (name === 'id') return this.id;
    if (name === 'autocomplete') return this.autocomplete;
    if (name === 'placeholder') return this.placeholder;
    return '';
  },
};

const explicitEmailInput = {
  type: 'email',
  name: 'email',
  id: 'secondary-email',
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
    innerText: 'Welcome back Continue with phone number',
    textContent: 'Welcome back Continue with phone number',
  },
  querySelectorAll(selector) {
    if (String(selector || '').includes('input[type="email"]')) {
      return [genericUsernameInput, explicitEmailInput];
    }
    return [];
  },
  querySelector() {
    return null;
  },
};

function isAddPhonePageReady() { return false; }
function isPhoneVerificationPageReady() { return false; }
function isVisibleElement() { return true; }

return {
  getLoginEmailInput,
};
`)();
}

{
  const api = createAmbiguousMixedLoginStateApi();
  assert.strictEqual(
    api.getLoginEmailInput(),
    null,
    'when mixed log-in page resolves the first visible candidate to a generic username field, it should stay suppressed to match Ultra7.3'
  );
}

console.log('step6 login state tests passed');
