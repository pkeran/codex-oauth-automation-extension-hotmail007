const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports navigation utils module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/navigation-utils\.js/);
});

test('navigation utils module exposes a factory', () => {
  const source = fs.readFileSync('background/navigation-utils.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundNavigationUtils;`)(globalScope);

  assert.equal(typeof api?.createNavigationUtils, 'function');
});

test('navigation utils treat 126 mail hosts as part of the shared NetEase mail family', () => {
  const source = fs.readFileSync('background/navigation-utils.js', 'utf8');
  const globalScope = {};
  const moduleApi = new Function('self', `${source}; return self.MultiPageBackgroundNavigationUtils;`)(globalScope);
  const navigationUtils = moduleApi.createNavigationUtils({
    DEFAULT_SUB2API_URL: 'https://example.com/admin/accounts',
    normalizeLocalCpaStep9Mode: value => value,
  });

  assert.equal(navigationUtils.is163MailHost('mail.126.com'), true);
  assert.equal(
    navigationUtils.matchesSourceUrlFamily(
      'mail-163',
      'https://mail.126.com/js6/main.jsp',
      'https://mail.163.com/js6/main.jsp'
    ),
    true
  );
});
