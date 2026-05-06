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

test('guided onboarding page is recognized and prefers skip-tour', () => {
  const api = new Function(`
const skipTourButton = {
  textContent: '跳过导览',
  tagName: 'BUTTON',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-label') return '跳过导览';
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
    innerText: '有问题，尽管问 从快速提问到大胆创意，ChatGPT 随时为你提供帮助。 跳过导览 下一步',
  },
  querySelector(selector) {
    if (selector.includes('dialog')) {
      return { tagName: 'DIALOG', getAttribute() { return ''; } };
    }
    return null;
  },
  querySelectorAll() {
    return [skipTourButton, nextButton];
  },
};
const location = { href: 'https://auth.openai.com/create-account/onboarding' };
const POST_SIGNUP_ONBOARDING_TITLE_PATTERN = /what\\s+brings\\s+you\\s+to\\s+chatgpt|what\\s+brought\\s+you\\s+to\\s+chatgpt|是什么促使你使用\\s*chatgpt|你为何使用\\s*chatgpt|你想如何使用\\s*chatgpt/i;
const POST_SIGNUP_ONBOARDING_SKIP_PATTERN = /skip(?:\\s+(?:tour|guide|intro))?|跳过(?:导览)?/i;
const POST_SIGNUP_ONBOARDING_NEXT_PATTERN = /next|continue|get\\s*started|start|let'?s\\s*go|下一步|继续|开始吧|好的，开始吧/i;
const POST_SIGNUP_ONBOARDING_OPTION_PATTERNS = [
  /school|学校/i,
  /work|工作/i,
  /personal\\s+tasks?|个人任务/i,
  /fun\\s+and\\s+entertainment|乐趣和娱乐/i,
  /other|其他/i,
];
const POST_SIGNUP_ONBOARDING_GUIDE_PATTERN = /有问题，尽管问|从快速提问到大胆创意|跳过导览|你已准备就绪|继续操作即表示你同意|请勿共享敏感信息|请核实你的信息|ChatGPT 入门技巧/i;
const POST_SIGNUP_ONBOARDING_ROOT_SELECTOR = '#modal-onboarding, [data-testid="modal-onboarding"], [data-testid="getting-started-button"], dialog[aria-label*="ChatGPT"], dialog[aria-label*="准备就绪"], dialog[aria-label*="尽管问"]';

function getStep4PostVerificationState() { return null; }
function isSignupPasswordErrorPage() { return false; }
function getSignupPasswordTimeoutErrorPageState() { return null; }
function isPhoneVerificationPageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function isSignupEmailAlreadyExistsPage() { return false; }
function getSignupPasswordInput() { return null; }
function getSignupPasswordSubmitButton() { return null; }
function isVisibleElement() { return true; }
function isActionEnabled(element) { return Boolean(element) && !element.disabled; }
function getActionText(element) { return String(element?.textContent || '').trim(); }

${extractFunction('detectPostSignupOnboardingState')}
${extractFunction('inspectSignupVerificationState')}

return {
  run() { return inspectSignupVerificationState(); },
  buttons: { skipTourButton, nextButton },
};
`)();

  const snapshot = api.run();
  assert.equal(snapshot.state, 'post_signup_onboarding_page');
  assert.equal(snapshot.skipButton, api.buttons.skipTourButton);
  assert.equal(snapshot.nextButton, api.buttons.nextButton);
});

test('ready page is recognized with continue action', () => {
  const api = new Function(`
const continueButton = {
  textContent: '继续',
  tagName: 'BUTTON',
  disabled: false,
  getAttribute(name) {
    if (name === 'aria-label') return '继续';
    return '';
  },
};
const document = {
  body: {
    innerText: '你已准备就绪 继续操作即表示你同意我们的条款，并已阅读我们的隐私政策。',
  },
  querySelector() { return null; },
  querySelectorAll() { return [continueButton]; },
};
const location = { href: 'https://chatgpt.com/' };
const POST_SIGNUP_ONBOARDING_TITLE_PATTERN = /what\\s+brings\\s+you\\s+to\\s+chatgpt|what\\s+brought\\s+you\\s+to\\s+chatgpt|是什么促使你使用\\s*chatgpt|你为何使用\\s*chatgpt|你想如何使用\\s*chatgpt/i;
const POST_SIGNUP_ONBOARDING_SKIP_PATTERN = /skip(?:\\s+(?:tour|guide|intro))?|跳过(?:导览)?/i;
const POST_SIGNUP_ONBOARDING_NEXT_PATTERN = /next|continue|get\\s*started|start|let'?s\\s*go|下一步|继续|开始吧|好的，开始吧/i;
const POST_SIGNUP_ONBOARDING_OPTION_PATTERNS = [
  /school|学校/i,
  /work|工作/i,
  /personal\\s+tasks?|个人任务/i,
  /fun\\s+and\\s+entertainment|乐趣和娱乐/i,
  /other|其他/i,
];
const POST_SIGNUP_ONBOARDING_GUIDE_PATTERN = /有问题，尽管问|从快速提问到大胆创意|跳过导览|你已准备就绪|继续操作即表示你同意|请勿共享敏感信息|请核实你的信息|ChatGPT 入门技巧/i;
const POST_SIGNUP_ONBOARDING_ROOT_SELECTOR = '#modal-onboarding, [data-testid="modal-onboarding"], [data-testid="getting-started-button"], dialog[aria-label*="ChatGPT"], dialog[aria-label*="准备就绪"], dialog[aria-label*="尽管问"]';

function getStep4PostVerificationState() { return null; }
function isSignupPasswordErrorPage() { return false; }
function getSignupPasswordTimeoutErrorPageState() { return null; }
function isPhoneVerificationPageReady() { return false; }
function isVerificationPageStillVisible() { return false; }
function isSignupEmailAlreadyExistsPage() { return false; }
function getSignupPasswordInput() { return null; }
function getSignupPasswordSubmitButton() { return null; }
function isVisibleElement() { return true; }
function isActionEnabled(element) { return Boolean(element) && !element.disabled; }
function getActionText(element) { return String(element?.textContent || '').trim(); }

${extractFunction('detectPostSignupOnboardingState')}
${extractFunction('inspectSignupVerificationState')}

return {
  run() { return inspectSignupVerificationState(); },
  button: continueButton,
};
`)();

  const snapshot = api.run();
  assert.equal(snapshot.state, 'post_signup_onboarding_page');
  assert.equal(snapshot.skipButton, null);
  assert.equal(snapshot.nextButton, api.button);
});

test('prepare flow clicks getting-started button inside app onboarding modal', async () => {
  const api = new Function(`
const clicks = [];
const location = { href: 'https://chatgpt.com/' };
const startButton = { textContent: '好的，开始吧', disabled: false };
let state = 'post_signup_onboarding_page';

function throwIfStopped() {}
function log() {}
async function humanPause() {}
async function waitForDocumentLoadComplete() {}
async function waitForVerificationCodeTarget() {}
async function recoverCurrentAuthRetryPage() {}
function logSignupPasswordDiagnostics() {}
function isActionEnabled(element) { return Boolean(element) && !element.disabled; }
function getActionText(element) { return String(element?.textContent || '').trim(); }
function fillInput() {}
function simulateClick(element) {
  clicks.push(element?.textContent || '');
  if (element === startButton) {
    state = 'logged_in_home';
  }
}
async function sleep() {}
async function waitForSignupVerificationTransition() {
  if (state === 'post_signup_onboarding_page') {
    return {
      state,
      skipButton: null,
      nextButton: startButton,
      url: location.href,
    };
  }
  return {
    state: 'logged_in_home',
    skipProfileStep: true,
    url: location.href,
  };
}

${extractFunction('prepareSignupVerificationFlow')}

return {
  async run() { return prepareSignupVerificationFlow({}, 30); },
  snapshot() { return { clicks }; },
};
`)();

  const result = await api.run();
  assert.equal(result.ready, true);
  assert.equal(result.skipProfileStep, true);
  assert.deepStrictEqual(api.snapshot().clicks, ['好的，开始吧']);
});
