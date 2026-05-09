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
    if (ch === '(') parenDepth += 1;
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) signatureEnded = true;
    }
    if (ch === '{' && signatureEnded) {
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

test('background infers HeroSMS country ids from common phone prefixes', () => {
  const api = new Function(`
const HERO_SMS_COUNTRY_ID = 52;
${extractFunction('inferHeroSmsCountryIdFromPhoneNumber')}
return { inferHeroSmsCountryIdFromPhoneNumber };
`)();

  assert.equal(api.inferHeroSmsCountryIdFromPhoneNumber('66958888888'), 52);
  assert.equal(api.inferHeroSmsCountryIdFromPhoneNumber('628123456789'), 6);
  assert.equal(api.inferHeroSmsCountryIdFromPhoneNumber('447955001122'), 16);
  assert.equal(api.inferHeroSmsCountryIdFromPhoneNumber('84912345678'), 10);
  assert.equal(api.inferHeroSmsCountryIdFromPhoneNumber('819012345678'), 151);
  assert.equal(api.inferHeroSmsCountryIdFromPhoneNumber('4915112345678'), 43);
  assert.equal(api.inferHeroSmsCountryIdFromPhoneNumber('33612345678'), 73);
  assert.equal(api.inferHeroSmsCountryIdFromPhoneNumber('12025550123'), 187);
  assert.equal(api.inferHeroSmsCountryIdFromPhoneNumber('999'), 0);
});

test('background normalizeFreeReusablePhoneActivation uses phone-prefix country inference for HeroSMS manual records', () => {
  const api = new Function(`
const HERO_SMS_COUNTRY_ID = 52;
const HERO_SMS_SERVICE_CODE = 'dr';
const DEFAULT_PHONE_SMS_PROVIDER = 'hero-sms';
const DEFAULT_FIVE_SIM_PRODUCT = 'openai';
const DEFAULT_NEX_SMS_SERVICE_CODE = 'ot';
const FIVE_SIM_COUNTRY_ID = 'vietnam';
function normalizePhoneSmsProvider(value = '') {
  return String(value || 'hero-sms').trim().toLowerCase() || 'hero-sms';
}
function normalizeFiveSimCountryId(value, fallback = FIVE_SIM_COUNTRY_ID) {
  return String(value || fallback).trim() || fallback;
}
function normalizeNexSmsCountryId(value, fallback = 0) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function normalizeCountryId(value, fallback = HERO_SMS_COUNTRY_ID) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
${extractFunction('inferHeroSmsCountryIdFromPhoneNumber')}
${extractFunction('normalizeFreeReusablePhoneActivation')}
return { normalizeFreeReusablePhoneActivation };
`)();

  const normalized = api.normalizeFreeReusablePhoneActivation({
    phoneNumber: '447955001122',
    activationId: 'manual-uk-1',
    latestActivationId: 'manual-uk-1',
    provider: 'hero-sms',
    countryId: 0,
  }, {
    phoneSmsProvider: 'hero-sms',
    heroSmsCountryId: 52,
  });

  assert.equal(normalized.countryId, 16);
});
