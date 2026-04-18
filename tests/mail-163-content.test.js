const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/mail-163.js', 'utf8');

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

test('handlePollEmail opens a matching 163 message and reads the body when the list row has no inline code', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('handlePollEmail'),
  ].join('\n');

  const api = new Function(`
const seenCodes = new Set();
const openedMailIds = [];
let state = 'empty';
const now = Date.now();

const inboxLink = {
  click() {
    state = 'ready';
  },
};

const mailItem = {
  getAttribute(name) {
    if (name === 'id') return 'mail-1';
    if (name === 'aria-label') return 'OpenAI 发件人 你的临时 ChatGPT 登录代码';
    return '';
  },
  querySelector(selector) {
    if (selector === '.nui-user') return { textContent: 'OpenAI' };
    if (selector === 'span.da0') return { textContent: '你的临时 ChatGPT 登录代码' };
    return null;
  },
};

function findMailItems() {
  return state === 'ready' ? [mailItem] : [];
}

function getCurrentMailIds() {
  return new Set(findMailItems().map((item) => item.getAttribute('id')));
}

function normalizeMinuteTimestamp(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  return date.getTime();
}

function getMailTimestamp() {
  return now;
}

async function waitForElement() {
  return inboxLink;
}

async function refreshInbox() {
  state = 'ready';
}

async function sleep() {}

function extractVerificationCode(text) {
  const match = String(text || '').match(/(\\d{6})/);
  return match ? match[1] : null;
}

async function openMailAndGetMessageText(item) {
  openedMailIds.push(item.getAttribute('id'));
  return '输入此临时验证码以继续：480382';
}

function persistSeenCodes() {}
function scheduleEmailCleanup() {}
function log() {}

${bundle}

return {
  handlePollEmail,
  getOpenedMailIds() {
    return openedMailIds.slice();
  },
};
`)();

  const result = await api.handlePollEmail(8, {
    senderFilters: ['openai'],
    subjectFilters: ['chatgpt'],
    maxAttempts: 1,
    intervalMs: 1,
    filterAfterTimestamp: Date.now(),
  });

  assert.equal(result.code, '480382');
  assert.deepEqual(api.getOpenedMailIds(), ['mail-1']);
});

test('refreshInbox prefers the top toolbar refresh button even when 163 renders the label as 刷 新', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('refreshInbox'),
  ].join('\n');

  const api = new Function(`
const MAIL163_PREFIX = '[MultiPage:mail-163]';
const clickOrder = [];

const refreshButton = {
  tagName: 'DIV',
  textContent: '刷 新',
};

const refreshLabel = {
  textContent: '刷 新',
  closest(selector) {
    return selector === '.nui-btn' ? refreshButton : null;
  },
};

const inboxLink = {
  tagName: 'SPAN',
  textContent: '收件箱',
};

const document = {
  querySelectorAll(selector) {
    if (selector === '.nui-btn .nui-btn-text') return [refreshLabel];
    if (selector === '.ra0') return [];
    return [];
  },
};

function simulateClick(node) {
  clickOrder.push(node.textContent);
}

function findInboxLink() {
  return inboxLink;
}

async function sleep() {}
function log() {}

${bundle}

return {
  refreshInbox,
  getClickOrder() {
    return clickOrder.slice();
  },
};
`)();

  await api.refreshInbox();

  assert.deepEqual(api.getClickOrder(), ['刷 新']);
});
