const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports logging/status module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/logging-status\.js/);
});

test('logging/status module exposes a factory', () => {
  const source = fs.readFileSync('background/logging-status.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundLoggingStatus;`)(globalScope);

  assert.equal(typeof api?.createLoggingStatus, 'function');
});

test('logging/status add-phone detection ignores step 2 phone-entry switch failures', () => {
  const source = fs.readFileSync('background/logging-status.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundLoggingStatus;`)(globalScope);

  const loggingStatus = api.createLoggingStatus({
    chrome: { runtime: { sendMessage() { return Promise.resolve(); } } },
    DEFAULT_STATE: { stepStatuses: {} },
    getState: async () => ({ stepStatuses: {} }),
    isRecoverableStep9AuthFailure: () => false,
    LOG_PREFIX: '[test]',
    setState: async () => {},
    STOP_ERROR_MESSAGE: 'stopped',
  });

  assert.equal(
    loggingStatus.isAddPhoneAuthFailure('姝ラ 2锛氬綋鍓嶉〉闈粛鍋滅暀鍦ㄦ墜鏈哄彿杈撳叆妯″紡锛屾湭鎴愬姛鍒囨崲鍒伴偖绠辫緭鍏ユā寮忋€俇RL: https://chatgpt.com/'),
    false
  );
  assert.equal(
    loggingStatus.isAddPhoneAuthFailure('姝ラ 8锛氶獙璇佺爜鎻愪氦鍚庨〉闈㈣繘鍏ユ墜鏈哄彿椤甸潰锛屽綋鍓嶆祦绋嬫棤娉曠户缁嚜鍔ㄦ巿鏉冦€?URL: https://auth.openai.com/add-phone'),
    true
  );
});
