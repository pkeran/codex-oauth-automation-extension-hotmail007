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

test('getVerificationErrorOutcome returns structured signup phone delivery blocked error', () => {
  const api = new Function(`
${extractConst('INVALID_VERIFICATION_CODE_PATTERN')}
${extractConst('PHONE_VERIFICATION_DELIVERY_BLOCKED_PATTERN')}
const VERIFICATION_CODE_INPUT_SELECTOR = 'input[name="code"]';
${extractFunction('getVerificationErrorMessages')}
${extractFunction('getVerificationErrorText')}
${extractFunction('getVerificationErrorOutcome')}

const errorNode = {
  textContent: '无法向此电话号码发送文本消息',
};
const document = {
  querySelectorAll(selector) {
    const text = String(selector || '');
    if (text.includes('react-aria-FieldError') || text.includes('[class*="error"]')) {
      return [errorNode];
    }
    return [];
  },
  querySelector() {
    return null;
  },
};

return {
  getVerificationErrorOutcome,
};
`)();

  const outcome = api.getVerificationErrorOutcome(4);
  assert.deepEqual(outcome, {
    phoneDeliveryBlocked: true,
    errorCode: 'PHONE_SIGNUP_CANNOT_SEND_TEXT',
    errorText: '无法向此电话号码发送文本消息',
  });
});
