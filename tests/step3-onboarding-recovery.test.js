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

test('inspectSignupEntryState recognizes post-signup onboarding page', () => {
  const api = new Function(`
const skipButton = {
  textContent: '跳过',
  tagName: 'BUTTON',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-label') return '跳过';
    return '';
  },
};
const nextButton = {
  textContent: '下一步',
  tagName: 'BUTTON',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-label') return '下一步';
    return '';
  },
};
const option = {
  textContent: '工作',
  tagName: 'BUTTON',
  disabled: false,
  getAttribute() {
    return '';
  },
};
const document = {
  body: {
    innerText: '是什么促使你使用 ChatGPT？\\n学校\\n工作\\n个人任务\\n乐趣和娱乐\\n其他',
  },
  querySelectorAll() {
    return [skipButton, nextButton, option];
  },
};
const location = {
  href: 'https://auth.openai.com/create-account/onboarding',
};
const POST_SIGNUP_ONBOARDING_TITLE_PATTERN = /what\\s+brings\\s+you\\s+to\\s+chatgpt|what\\s+brought\\s+you\\s+to\\s+chatgpt|是什么促使你使用\\s*chatgpt|你为何使用\\s*chatgpt|你想如何使用\\s*chatgpt/i;
const POST_SIGNUP_ONBOARDING_SKIP_PATTERN = /skip|跳过/i;
const POST_SIGNUP_ONBOARDING_NEXT_PATTERN = /next|continue|下一步|继续/i;
const POST_SIGNUP_ONBOARDING_OPTION_PATTERNS = [
  /school|学校/i,
  /work|工作/i,
  /personal\\s+tasks?|个人任务/i,
  /fun\\s+and\\s+entertainment|乐趣和娱乐/i,
  /other|其他/i,
];
const POST_SIGNUP_ONBOARDING_GUIDE_PATTERN = /有问题，尽管问|从快速提问到大胆创意|跳过导览|你已准备就绪|继续操作即表示你同意|请勿共享敏感信息|请核实你的信息|ChatGPT 入门技巧/i;
const POST_SIGNUP_ONBOARDING_ROOT_SELECTOR = '#modal-onboarding, [data-testid="modal-onboarding"], [data-testid="getting-started-button"], dialog[aria-label*="ChatGPT"], dialog[aria-label*="准备就绪"], dialog[aria-label*="尽管问"]';

function isPhoneVerificationPageReady() {
  return false;
}

function getVerificationCodeTarget() {
  return null;
}

function getPhoneVerificationDisplayedPhone() {
  return '';
}

function getStep4PostVerificationState() {
  return null;
}

function isVerificationPageStillVisible() {
  return false;
}

function getSignupPasswordInput() {
  return null;
}

function isSignupPasswordPage() {
  return false;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function getSignupPasswordDisplayedEmail() {
  return '';
}

function getSignupEmailInput() {
  return null;
}

function getSignupEmailContinueButton() {
  return null;
}

function findSignupUsePhoneTrigger() {
  return null;
}

function getSignupPhoneInput() {
  return null;
}

function findSignupUseEmailTrigger() {
  return null;
}

function findSignupEntryTrigger() {
  return null;
}

function isVisibleElement() {
  return true;
}

function isActionEnabled(element) {
  return Boolean(element) && !element.disabled;
}

function getActionText(element) {
  return String(element?.textContent || '').trim();
}

${extractFunction('detectPostSignupOnboardingState')}
${extractFunction('inspectSignupEntryState')}

return {
  run() {
    return inspectSignupEntryState();
  },
  buttons: {
    skipButton,
    nextButton,
  },
};
`)();

  const snapshot = api.run();
  assert.equal(snapshot.state, 'post_signup_onboarding_page');
  assert.equal(snapshot.skipButton, api.buttons.skipButton);
  assert.equal(snapshot.nextButton, api.buttons.nextButton);
});

test('inspectSignupVerificationState recognizes post-signup onboarding page', () => {
  const api = new Function(`
const skipButton = {
  textContent: '跳过',
  tagName: 'BUTTON',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-label') return '跳过';
    return '';
  },
};
const nextButton = {
  textContent: '下一步',
  tagName: 'BUTTON',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-label') return '下一步';
    return '';
  },
};
const document = {
  body: {
    innerText: 'What brings you to ChatGPT? Work Personal tasks Fun and entertainment',
  },
  querySelectorAll() {
    return [skipButton, nextButton];
  },
};
const location = {
  href: 'https://auth.openai.com/create-account/onboarding',
};
const POST_SIGNUP_ONBOARDING_TITLE_PATTERN = /what\\s+brings\\s+you\\s+to\\s+chatgpt|what\\s+brought\\s+you\\s+to\\s+chatgpt|是什么促使你使用\\s*chatgpt|你为何使用\\s*chatgpt|你想如何使用\\s*chatgpt/i;
const POST_SIGNUP_ONBOARDING_SKIP_PATTERN = /skip|跳过/i;
const POST_SIGNUP_ONBOARDING_NEXT_PATTERN = /next|continue|下一步|继续/i;
const POST_SIGNUP_ONBOARDING_OPTION_PATTERNS = [
  /school|学校/i,
  /work|工作/i,
  /personal\\s+tasks?|个人任务/i,
  /fun\\s+and\\s+entertainment|乐趣和娱乐/i,
  /other|其他/i,
];
const POST_SIGNUP_ONBOARDING_GUIDE_PATTERN = /有问题，尽管问|从快速提问到大胆创意|跳过导览|你已准备就绪|继续操作即表示你同意|请勿共享敏感信息|请核实你的信息|ChatGPT 入门技巧/i;
const POST_SIGNUP_ONBOARDING_ROOT_SELECTOR = '#modal-onboarding, [data-testid="modal-onboarding"], [data-testid="getting-started-button"], dialog[aria-label*="ChatGPT"], dialog[aria-label*="准备就绪"], dialog[aria-label*="尽管问"]';

function getStep4PostVerificationState() {
  return null;
}

function isSignupPasswordErrorPage() {
  return false;
}

function getSignupPasswordTimeoutErrorPageState() {
  return null;
}

function isPhoneVerificationPageReady() {
  return false;
}

function isVerificationPageStillVisible() {
  return false;
}

function isSignupEmailAlreadyExistsPage() {
  return false;
}

function getSignupPasswordInput() {
  return null;
}

function getSignupPasswordSubmitButton() {
  return null;
}

function isVisibleElement() {
  return true;
}

function isActionEnabled(element) {
  return Boolean(element) && !element.disabled;
}

function getActionText(element) {
  return String(element?.textContent || '').trim();
}

${extractFunction('detectPostSignupOnboardingState')}
${extractFunction('inspectSignupVerificationState')}

return {
  run() {
    return inspectSignupVerificationState();
  },
  buttons: {
    skipButton,
    nextButton,
  },
};
`)();

  const snapshot = api.run();
  assert.equal(snapshot.state, 'post_signup_onboarding_page');
  assert.equal(snapshot.skipButton, api.buttons.skipButton);
  assert.equal(snapshot.nextButton, api.buttons.nextButton);
});

test('prepareSignupVerificationFlow skips onboarding page and continues to verification page', async () => {
  const api = new Function(`
const clicks = [];
const logs = [];
const location = {
  href: 'https://auth.openai.com/create-account/onboarding',
};
const skipButton = {
  textContent: '跳过',
  disabled: false,
};
const nextButton = {
  textContent: '下一步',
  disabled: false,
};
let state = 'post_signup_onboarding_page';

function throwIfStopped() {}

function log(message, level = 'info') {
  logs.push({ message, level });
}

async function waitForSignupVerificationTransition() {
  if (state === 'post_signup_onboarding_page') {
    return {
      state,
      skipButton,
      nextButton,
      url: location.href,
    };
  }
  return {
    state: 'verification',
    url: 'https://auth.openai.com/email-verification',
  };
}

async function humanPause() {}
async function waitForDocumentLoadComplete() {}
async function waitForVerificationCodeTarget() {}
async function recoverCurrentAuthRetryPage() {}
function logSignupPasswordDiagnostics() {}
function isActionEnabled(element) {
  return Boolean(element) && !element.disabled;
}
function getActionText(element) {
  return String(element?.textContent || '').trim();
}
function fillInput() {}
function simulateClick(element) {
  clicks.push(element?.textContent || '');
  if (element === skipButton) {
    state = 'verification';
  }
}
async function sleep() {}

${extractFunction('prepareSignupVerificationFlow')}

return {
  async run() {
    return prepareSignupVerificationFlow({}, 30);
  },
  snapshot() {
    return { clicks, logs };
  },
};
`)();

  const result = await api.run();
  const snapshot = api.snapshot();
  assert.equal(result.ready, true);
  assert.equal(result.alreadyVerified, undefined);
  assert.deepStrictEqual(snapshot.clicks, ['跳过']);
});

test('prepareSignupVerificationFlow clicks next when onboarding page has no skip action', async () => {
  const api = new Function(`
const clicks = [];
const location = {
  href: 'https://auth.openai.com/create-account/onboarding',
};
const nextButton = {
  textContent: '下一步',
  disabled: false,
};
let state = 'post_signup_onboarding_page';

function throwIfStopped() {}
function log() {}

async function waitForSignupVerificationTransition() {
  if (state === 'post_signup_onboarding_page') {
    return {
      state,
      skipButton: null,
      nextButton,
      url: location.href,
    };
  }
  return {
    state: 'step5',
    url: 'https://auth.openai.com/create-account/profile',
  };
}

async function humanPause() {}
async function waitForDocumentLoadComplete() {}
async function waitForVerificationCodeTarget() {}
async function recoverCurrentAuthRetryPage() {}
function logSignupPasswordDiagnostics() {}
function isActionEnabled(element) {
  return Boolean(element) && !element.disabled;
}
function getActionText(element) {
  return String(element?.textContent || '').trim();
}
function fillInput() {}
function simulateClick(element) {
  clicks.push(element?.textContent || '');
  if (element === nextButton) {
    state = 'step5';
  }
}
async function sleep() {}

${extractFunction('prepareSignupVerificationFlow')}

return {
  async run() {
    return prepareSignupVerificationFlow({}, 30);
  },
  snapshot() {
    return { clicks };
  },
};
`)();

  const result = await api.run();
  assert.equal(result.ready, true);
  assert.equal(result.alreadyVerified, true);
  assert.deepStrictEqual(api.snapshot().clicks, ['下一步']);
});
