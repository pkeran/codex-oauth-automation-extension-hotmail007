const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/phone-verification-flow.js', 'utf8');

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

test('readPhonePageState caps probe timeout so page-state hangs do not block verification polling', async () => {
  const api = new Function(`
let capturedOptions = null;
let activePhoneVerificationLogStep = 9;
function normalizeLogStep(value) {
  return Number(value) || 0;
}
async function ensureStep8SignupPageReady() {}
async function sendToContentScriptResilient(_source, _message, options = {}) {
  capturedOptions = options;
  return { addPhonePage: true, url: 'https://auth.openai.com/add-phone' };
}
${extractFunction('readPhonePageState')}
return {
  async run() {
    await readPhonePageState(88, 15000);
    return capturedOptions;
  },
};
`)();

  const options = await api.run();
  assert.equal(Number(options?.responseTimeoutMs) <= 6000, true);
  assert.equal(Number(options?.timeoutMs) <= 6000, true);
});
