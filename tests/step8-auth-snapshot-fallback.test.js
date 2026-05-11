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

test('getStep8PageState falls back to tab url snapshot when content script transport fails on add-phone', async () => {
  const api = new Function(`
const chrome = {
  tabs: {
    async get() {
      return {
        id: 88,
        url: 'https://auth.openai.com/add-phone',
      };
    },
  },
};
function isRetryableContentScriptTransportError(error) {
  return /Receiving end does not exist/i.test(String(error?.message || error || ''));
}
${extractFunction('isAddPhoneAuthUrl')}
async function sendTabMessageWithTimeout() {
  throw new Error('Receiving end does not exist.');
}
${extractFunction('getStep8PageState')}
return {
  async run() {
    return getStep8PageState(88, 1500, 9);
  },
};
`)();

  const result = await api.run();
  assert.equal(result?.snapshotSource, 'tab_url_fallback');
  assert.equal(result?.addPhonePage, true);
  assert.equal(result?.url, 'https://auth.openai.com/add-phone');
});

test('getStep8PageState falls back to consent-ready snapshot when auth tab url is already on consent', async () => {
  const api = new Function(`
const chrome = {
  tabs: {
    async get() {
      return {
        id: 88,
        url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent',
      };
    },
  },
};
function isRetryableContentScriptTransportError(error) {
  return /did not respond/i.test(String(error?.message || error || ''));
}
${extractFunction('isAddPhoneAuthUrl')}
async function sendTabMessageWithTimeout() {
  throw new Error('signup-page did not respond in 1s');
}
${extractFunction('getStep8PageState')}
return {
  async run() {
    return getStep8PageState(88, 1500, 9);
  },
};
`)();

  const result = await api.run();
  assert.equal(result?.snapshotSource, 'tab_url_fallback');
  assert.equal(result?.consentReady, true);
  assert.equal(result?.consentPage, true);
});
