const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HOTMAIL_PROVIDER,
  getMailProviderConfig,
  normalizeMailProvider,
} = require('../mail-provider-utils.js');

test('normalizeMailProvider accepts 126 and falls back to 163', () => {
  assert.equal(normalizeMailProvider('126'), '126');
  assert.equal(normalizeMailProvider('163-vip'), '163-vip');
  assert.equal(normalizeMailProvider('unknown-provider'), '163');
});

test('getMailProviderConfig returns the shared NetEase source for 126 mail', () => {
  assert.deepEqual(
    getMailProviderConfig({ mailProvider: '126' }),
    {
      source: 'mail-163',
      url: 'https://mail.126.com/js6/main.jsp?df=mail163_letter#module=mbox.ListModule%7C%7B%22fid%22%3A1%2C%22order%22%3A%22date%22%2C%22desc%22%3Atrue%7D',
      label: '126 邮箱',
    }
  );
});

test('getMailProviderConfig preserves the hotmail provider sentinel', () => {
  assert.deepEqual(
    getMailProviderConfig({ mailProvider: HOTMAIL_PROVIDER }),
    {
      provider: HOTMAIL_PROVIDER,
      label: 'Hotmail（微软 Graph）',
    }
  );
});
