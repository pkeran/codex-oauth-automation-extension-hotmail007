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

test('getVerificationErrorOutcome returns structured http500 recovery error on contact-verification page', () => {
  const errorText = 'auth.openai.com 当前无法处理此请求。 HTTP ERROR 500';
  const api = new Function(`
${extractConst('INVALID_VERIFICATION_CODE_PATTERN')}
${extractConst('PHONE_VERIFICATION_DELIVERY_BLOCKED_PATTERN')}
${extractConst('PHONE_VERIFICATION_NUMBER_USED_PATTERN')}
${extractConst('PHONE_VERIFICATION_NUMBER_INVALID_PATTERN')}
${extractConst('PHONE_VERIFICATION_HTTP_500_PATTERN')}
const VERIFICATION_CODE_INPUT_SELECTOR = 'input[name="code"]';
${extractFunction('getVerificationErrorMessages')}
${extractFunction('getVerificationErrorText')}
${extractFunction('getVerificationErrorOutcome')}

const errorNode = {
  textContent: ${JSON.stringify(errorText)},
};
const location = {
  href: 'https://auth.openai.com/contact-verification',
  pathname: '/contact-verification',
};
const document = {
  title: '当前无法使用此页面',
  body: {
    textContent: ${JSON.stringify(errorText)},
  },
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
    verificationHttp500: true,
    errorCode: 'PHONE_SIGNUP_VERIFICATION_HTTP_500',
    errorText,
  });
});
