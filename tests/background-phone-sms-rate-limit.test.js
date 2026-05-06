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

test('background phone-sms rate-limit detection is provider-agnostic and supports structured errors', () => {
  const api = new Function(`
${extractFunction('getErrorMessage')}
${extractFunction('isPhoneSmsPlatformRateLimitFailure')}
return { isPhoneSmsPlatformRateLimitFailure };
`)();

  const structured = new Error('structured-rate-limit');
  structured.code = 'PHONE_SMS_RATE_LIMIT';
  assert.equal(api.isPhoneSmsPlatformRateLimitFailure(structured), true);

  assert.equal(
    api.isPhoneSmsPlatformRateLimitFailure(new Error('HeroSMS purchase failed: temporary unavailable (429)')),
    true
  );
  assert.equal(
    api.isPhoneSmsPlatformRateLimitFailure(new Error('NexSMS purchase failed: too many requests, try later')),
    true
  );
  assert.equal(
    api.isPhoneSmsPlatformRateLimitFailure(new Error('HeroSMS no numbers available across 1 country candidate(s): Thailand: NO_NUMBERS.')),
    false
  );
});
