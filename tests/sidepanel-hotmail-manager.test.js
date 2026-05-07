const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function createAccountPoolUiStub() {
  return {
    createAccountPoolFormController({
      formShell,
      toggleButton,
      hiddenLabel = '添加账号',
      visibleLabel = '取消添加',
      onClear,
      onFocus,
    } = {}) {
      let visible = false;

      function sync() {
        if (formShell) {
          formShell.hidden = !visible;
        }
        if (toggleButton) {
          toggleButton.textContent = visible ? visibleLabel : hiddenLabel;
          toggleButton.setAttribute?.('aria-expanded', String(visible));
        }
      }

      function setVisible(nextVisible, options = {}) {
        visible = Boolean(nextVisible);
        if (options.clearForm) {
          onClear?.();
        }
        sync();
        if (visible && options.focusField) {
          onFocus?.();
        }
      }

      sync();
      return {
        isVisible: () => visible,
        setVisible,
        sync,
      };
    },
  };
}

test('sidepanel loads hotmail manager before sidepanel bootstrap', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const helperIndex = html.indexOf('<script src="account-pool-ui.js"></script>');
  const hotmailManagerIndex = html.indexOf('<script src="hotmail-manager.js"></script>');
  const sidepanelIndex = html.indexOf('<script src="sidepanel.js"></script>');

  assert.notEqual(helperIndex, -1);
  assert.notEqual(hotmailManagerIndex, -1);
  assert.notEqual(sidepanelIndex, -1);
  assert.ok(helperIndex < hotmailManagerIndex);
  assert.ok(hotmailManagerIndex < sidepanelIndex);
});

test('sidepanel html contains collapsible hotmail form controls', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  assert.match(html, /id="btn-toggle-hotmail-form"/);
  assert.match(html, /id="hotmail-form-shell"/);
  assert.match(html, /id="btn-import-hotmail-accounts"[^>]*>批量导入</);
});

test('sidepanel html contains hotmail007 automation controls and account view toggle', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  assert.match(html, /id="select-hotmail-account-source"/);
  assert.match(html, /id="input-hotmail007-client-key"/);
  assert.match(html, /id="select-hotmail007-mail-type"/);
  assert.match(html, /id="input-hotmail007-purchase-quantity"/);
  assert.match(html, /id="btn-hotmail007-refresh-catalog"/);
  assert.match(html, /id="btn-hotmail007-balance"/);
  assert.match(html, /id="display-hotmail007-balance"/);
  assert.match(html, /id="display-hotmail007-stock"/);
  assert.match(html, /id="btn-hotmail007-prefetch-account"/);
  assert.match(html, /id="btn-toggle-hotmail-view"/);
  assert.match(html, /id="btn-export-hotmail007-long-lived-json"/);
  assert.match(html, /id="btn-export-hotmail007-long-lived-csv"/);
  assert.match(html, /id="btn-export-hotmail007-long-lived-txt"/);
});

test('sidepanel css gives hotmail007 action row enough room and allows the status text to wrap', () => {
  const css = fs.readFileSync('sidepanel/sidepanel.css', 'utf8');
  assert.match(css, /#row-hotmail007-prefetch > \.data-label/);
  assert.match(css, /\.hotmail007-inline\s*\{[^}]*flex-wrap:\s*wrap;/s);
  assert.match(css, /\.hotmail007-status\s*\{[^}]*white-space:\s*normal;/s);
});

test('hotmail manager exposes a factory and renders empty state', () => {
  const source = fs.readFileSync('sidepanel/hotmail-manager.js', 'utf8');
  const windowObject = {
    SidepanelAccountPoolUi: createAccountPoolUiStub(),
  };
  const localStorageMock = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  const api = new Function('window', 'localStorage', `${source}; return window.SidepanelHotmailManager;`)(
    windowObject,
    localStorageMock
  );

  assert.equal(typeof api?.createHotmailManager, 'function');

  const hotmailAccountsList = { innerHTML: '' };
  const toggleButton = {
    textContent: '',
    disabled: false,
    setAttribute() {},
  };
  const noopClassList = { toggle() {} };

  const manager = api.createHotmailManager({
    state: {
      getLatestState: () => ({ currentHotmailAccountId: null }),
      syncLatestState() {},
    },
    dom: {
      btnClearUsedHotmailAccounts: { textContent: '', disabled: false },
      btnDeleteAllHotmailAccounts: { textContent: '', disabled: false },
      btnToggleHotmailList: toggleButton,
      hotmailAccountsList,
      hotmailListShell: { classList: noopClassList },
      selectMailProvider: { value: 'hotmail-api' },
      inputEmail: { value: '' },
    },
    helpers: {
      getHotmailAccounts: () => [],
      getCurrentHotmailEmail: () => '',
      escapeHtml: (value) => String(value || ''),
      showToast() {},
      openConfirmModal: async () => true,
      copyTextToClipboard: async () => {},
    },
    runtime: {
      sendMessage: async () => ({}),
    },
    constants: {
      copyIcon: '',
      displayTimeZone: 'Asia/Shanghai',
      expandedStorageKey: 'multipage-hotmail-list-expanded',
    },
    hotmailUtils: {},
  });

  assert.equal(typeof manager.renderHotmailAccounts, 'function');
  assert.equal(typeof manager.bindHotmailEvents, 'function');
  assert.equal(typeof manager.initHotmailListExpandedState, 'function');

  manager.renderHotmailAccounts();
  assert.match(hotmailAccountsList.innerHTML, /还没有 Hotmail 账号/);
});

test('hotmail manager toggles form container from header button', () => {
  const source = fs.readFileSync('sidepanel/hotmail-manager.js', 'utf8');
  const windowObject = {
    SidepanelAccountPoolUi: createAccountPoolUiStub(),
  };
  const localStorageMock = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  const api = new Function('window', 'localStorage', `${source}; return window.SidepanelHotmailManager;`)(
    windowObject,
    localStorageMock
  );

  const handlers = {};
  const toggleFormButton = {
    textContent: '',
    disabled: false,
    setAttribute(name, value) {
      this[name] = value;
    },
    addEventListener(type, handler) {
      if (type === 'click') handlers.toggleForm = handler;
    },
  };
  const formShell = { hidden: true };

  const manager = api.createHotmailManager({
    state: {
      getLatestState: () => ({ currentHotmailAccountId: null }),
      syncLatestState() {},
    },
    dom: {
      btnAddHotmailAccount: { textContent: '', disabled: false, addEventListener() {} },
      btnClearUsedHotmailAccounts: { textContent: '', disabled: false, addEventListener() {} },
      btnDeleteAllHotmailAccounts: { textContent: '', disabled: false, addEventListener() {} },
      btnHotmailUsageGuide: { addEventListener() {} },
      btnImportHotmailAccounts: { disabled: false, addEventListener() {} },
      btnToggleHotmailForm: toggleFormButton,
      btnToggleHotmailList: { textContent: '', disabled: false, setAttribute() {}, addEventListener() {} },
      hotmailAccountsList: { innerHTML: '', addEventListener() {} },
      hotmailFormShell: formShell,
      hotmailListShell: { classList: { toggle() {} } },
      inputEmail: { value: '' },
      inputHotmailClientId: { value: '' },
      inputHotmailEmail: { value: '', focus() { this.focused = true; } },
      inputHotmailImport: { value: '' },
      inputHotmailPassword: { value: '' },
      inputHotmailRefreshToken: { value: '' },
      selectMailProvider: { value: 'hotmail-api' },
    },
    helpers: {
      getHotmailAccounts: () => [],
      getCurrentHotmailEmail: () => '',
      escapeHtml: (value) => String(value || ''),
      showToast() {},
      openConfirmModal: async () => true,
      copyTextToClipboard: async () => {},
    },
    runtime: {
      sendMessage: async () => ({}),
    },
    constants: {
      copyIcon: '',
      displayTimeZone: 'Asia/Shanghai',
      expandedStorageKey: 'multipage-hotmail-list-expanded',
    },
    hotmailUtils: {},
  });

  manager.bindHotmailEvents();
  assert.equal(formShell.hidden, true);
  assert.equal(toggleFormButton.textContent, '添加账号');

  handlers.toggleForm();
  assert.equal(formShell.hidden, false);
  assert.equal(toggleFormButton.textContent, '取消添加');

  handlers.toggleForm();
  assert.equal(formShell.hidden, true);
  assert.equal(toggleFormButton.textContent, '添加账号');
});

test('hotmail manager hides form after save succeeds', async () => {
  const source = fs.readFileSync('sidepanel/hotmail-manager.js', 'utf8');
  const windowObject = {
    SidepanelAccountPoolUi: createAccountPoolUiStub(),
  };
  const localStorageMock = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  const api = new Function('window', 'localStorage', `${source}; return window.SidepanelHotmailManager;`)(
    windowObject,
    localStorageMock
  );

  const handlers = {};
  const formShell = { hidden: true };
  const toggleFormButton = {
    textContent: '',
    disabled: false,
    setAttribute() {},
    addEventListener(type, handler) {
      if (type === 'click') handlers.toggleForm = handler;
    },
  };
  const addButton = {
    textContent: '',
    disabled: false,
    addEventListener(type, handler) {
      if (type === 'click') handlers.add = handler;
    },
  };
  const inputHotmailEmail = { value: '', focus() {} };
  const inputHotmailClientId = { value: '' };
  const inputHotmailPassword = { value: '' };
  const inputHotmailRefreshToken = { value: '' };
  const toastMessages = [];

  const manager = api.createHotmailManager({
    state: {
      getLatestState: () => ({ currentHotmailAccountId: null }),
      syncLatestState() {},
    },
    dom: {
      btnAddHotmailAccount: addButton,
      btnClearUsedHotmailAccounts: { textContent: '', disabled: false, addEventListener() {} },
      btnDeleteAllHotmailAccounts: { textContent: '', disabled: false, addEventListener() {} },
      btnHotmailUsageGuide: { addEventListener() {} },
      btnImportHotmailAccounts: { disabled: false, addEventListener() {} },
      btnToggleHotmailForm: toggleFormButton,
      btnToggleHotmailList: { textContent: '', disabled: false, setAttribute() {}, addEventListener() {} },
      hotmailAccountsList: { innerHTML: '', addEventListener() {} },
      hotmailFormShell: formShell,
      hotmailListShell: { classList: { toggle() {} } },
      inputEmail: { value: '' },
      inputHotmailClientId,
      inputHotmailEmail,
      inputHotmailImport: { value: '' },
      inputHotmailPassword,
      inputHotmailRefreshToken,
      selectMailProvider: { value: 'hotmail-api' },
    },
    helpers: {
      getHotmailAccounts: () => [],
      getCurrentHotmailEmail: () => '',
      escapeHtml: (value) => String(value || ''),
      showToast(message) {
        toastMessages.push(message);
      },
      openConfirmModal: async () => true,
      copyTextToClipboard: async () => {},
    },
    runtime: {
      sendMessage: async () => ({
        account: {
          id: 'acc-1',
          email: 'demo@hotmail.com',
          clientId: 'client-id',
          refreshToken: 'refresh-token',
        },
      }),
    },
    constants: {
      copyIcon: '',
      displayTimeZone: 'Asia/Shanghai',
      expandedStorageKey: 'multipage-hotmail-list-expanded',
    },
    hotmailUtils: {},
  });

  manager.bindHotmailEvents();
  handlers.toggleForm();
  inputHotmailEmail.value = 'demo@hotmail.com';
  inputHotmailClientId.value = 'client-id';
  inputHotmailPassword.value = 'secret';
  inputHotmailRefreshToken.value = 'refresh-token';

  await handlers.add();

  assert.equal(formShell.hidden, true);
  assert.equal(toggleFormButton.textContent, '添加账号');
  assert.equal(inputHotmailEmail.value, '');
  assert.equal(inputHotmailClientId.value, '');
  assert.equal(inputHotmailPassword.value, '');
  assert.equal(inputHotmailRefreshToken.value, '');
  assert.match(toastMessages.at(-1) || '', /已保存 Hotmail 账号/);
});

test('hotmail manager forwards manual hotmail007 purchase quantity to background prefetch message', async () => {
  const source = fs.readFileSync('sidepanel/hotmail-manager.js', 'utf8');
  const windowObject = {
    SidepanelAccountPoolUi: createAccountPoolUiStub(),
  };
  const localStorageMock = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  const api = new Function('window', 'localStorage', `${source}; return window.SidepanelHotmailManager;`)(
    windowObject,
    localStorageMock
  );

  const handlers = {};
  const sentMessages = [];

  const manager = api.createHotmailManager({
    state: {
      getLatestState: () => ({ currentHotmailAccountId: null }),
      syncLatestState() {},
    },
    dom: {
      btnAddHotmailAccount: { addEventListener() {} },
      btnClearUsedHotmailAccounts: { textContent: '', disabled: false, addEventListener() {} },
      btnDeleteAllHotmailAccounts: { textContent: '', disabled: false, addEventListener() {} },
      btnHotmail007Balance: { addEventListener() {} },
      btnHotmail007PrefetchAccount: {
        disabled: false,
        addEventListener(type, handler) {
          if (type === 'click') handlers.prefetch = handler;
        },
      },
      btnHotmail007RefreshCatalog: { addEventListener() {} },
      btnHotmailUsageGuide: { addEventListener() {} },
      btnImportHotmailAccounts: { disabled: false, addEventListener() {} },
      btnToggleHotmailForm: { setAttribute() {}, addEventListener() {} },
      btnToggleHotmailList: { textContent: '', disabled: false, setAttribute() {}, addEventListener() {} },
      btnToggleHotmailView: { textContent: '', disabled: false, setAttribute() {}, addEventListener() {} },
      displayHotmail007Balance: { textContent: '' },
      displayHotmail007Status: { textContent: '' },
      displayHotmail007Stock: { textContent: '' },
      hotmailAccountsList: { innerHTML: '', addEventListener() {}, classList: { toggle() {} } },
      hotmailFormShell: { hidden: true },
      hotmailListShell: { classList: { toggle() {} } },
      inputEmail: { value: '' },
      inputHotmail007ClientKey: { value: 'client-key-1' },
      inputHotmail007PurchaseQuantity: { value: '5' },
      inputHotmailClientId: { value: '' },
      inputHotmailEmail: { value: '', focus() {} },
      inputHotmailImport: { value: '' },
      inputHotmailPassword: { value: '' },
      inputHotmailRefreshToken: { value: '' },
      inputHotmailSearch: { value: '', addEventListener() {} },
      selectHotmail007MailType: { value: 'hotmail-premium', innerHTML: '', addEventListener() {} },
      selectHotmailAccountSource: { value: 'hotmail007' },
      selectHotmailFilter: { value: 'all', addEventListener() {} },
      selectMailProvider: { value: 'hotmail-api' },
    },
    helpers: {
      getHotmailAccounts: () => [],
      getCurrentHotmailEmail: () => '',
      escapeHtml: (value) => String(value || ''),
      showToast() {},
      openConfirmModal: async () => true,
      copyTextToClipboard: async () => {},
    },
    runtime: {
      sendMessage: async (message) => {
        sentMessages.push(message);
        return {
          accounts: [{ id: 'acc-1', email: 'demo@hotmail.com' }],
          account: { id: 'acc-1', email: 'demo@hotmail.com' },
        };
      },
    },
    constants: {
      copyIcon: '',
      displayTimeZone: 'Asia/Shanghai',
      expandedStorageKey: 'multipage-hotmail-list-expanded',
    },
    hotmailUtils: {},
  });

  manager.bindHotmailEvents();
  await handlers.prefetch();

  assert.deepEqual(sentMessages[0], {
    type: 'PREFETCH_HOTMAIL007_ACCOUNT',
    source: 'sidepanel',
    payload: {
      clientKey: 'client-key-1',
      mailType: 'hotmail-premium',
      quantity: 5,
    },
  });
});

test('hotmail manager exports hotmail007 long-lived accounts in json/csv/txt formats', async () => {
  const source = fs.readFileSync('sidepanel/hotmail-manager.js', 'utf8');
  const windowObject = {
    SidepanelAccountPoolUi: createAccountPoolUiStub(),
  };
  const localStorageMock = {
    getItem() {
      return null;
    },
    setItem() {},
  };

  const api = new Function('window', 'localStorage', `${source}; return window.SidepanelHotmailManager;`)(
    windowObject,
    localStorageMock
  );

  const handlers = {};
  const sentMessages = [];
  const downloads = [];

  function createExportButton(format) {
    return {
      disabled: false,
      addEventListener(type, handler) {
        if (type === 'click') handlers[format] = handler;
      },
    };
  }

  const manager = api.createHotmailManager({
    state: {
      getLatestState: () => ({ currentHotmailAccountId: null }),
      syncLatestState() {},
    },
    dom: {
      btnAddHotmailAccount: { addEventListener() {} },
      btnClearUsedHotmailAccounts: { textContent: '', disabled: false, addEventListener() {} },
      btnDeleteAllHotmailAccounts: { textContent: '', disabled: false, addEventListener() {} },
      btnExportHotmail007LongLivedJson: createExportButton('json'),
      btnExportHotmail007LongLivedCsv: createExportButton('csv'),
      btnExportHotmail007LongLivedTxt: createExportButton('txt'),
      btnHotmail007Balance: { addEventListener() {} },
      btnHotmail007PrefetchAccount: { addEventListener() {} },
      btnHotmail007RefreshCatalog: { addEventListener() {} },
      btnHotmailUsageGuide: { addEventListener() {} },
      btnImportHotmailAccounts: { disabled: false, addEventListener() {} },
      btnToggleHotmailForm: { setAttribute() {}, addEventListener() {} },
      btnToggleHotmailList: { textContent: '', disabled: false, setAttribute() {}, addEventListener() {} },
      btnToggleHotmailView: { textContent: '', disabled: false, setAttribute() {}, addEventListener() {} },
      displayHotmail007Balance: { textContent: '' },
      displayHotmail007Status: { textContent: '' },
      displayHotmail007Stock: { textContent: '' },
      hotmailAccountsList: { innerHTML: '', addEventListener() {}, classList: { toggle() {} } },
      hotmailFormShell: { hidden: true },
      hotmailListShell: { classList: { toggle() {} }, addEventListener() {} },
      inputEmail: { value: '' },
      inputHotmail007ClientKey: { value: 'client-key-1' },
      inputHotmail007PurchaseQuantity: { value: '1' },
      inputHotmailClientId: { value: '' },
      inputHotmailEmail: { value: '', focus() {} },
      inputHotmailImport: { value: '' },
      inputHotmailPassword: { value: '' },
      inputHotmailRefreshToken: { value: '' },
      inputHotmailSearch: { value: '', addEventListener() {} },
      selectHotmail007MailType: { value: 'hotmail Trusted Graph', innerHTML: '', addEventListener() {} },
      selectHotmailAccountSource: { value: 'hotmail007' },
      selectHotmailFilter: { value: 'all', addEventListener() {} },
      selectMailProvider: { value: 'hotmail-api' },
    },
    helpers: {
      downloadTextFile(content, fileName, mimeType) {
        downloads.push({ content, fileName, mimeType });
      },
      getHotmailAccounts: () => [],
      getCurrentHotmailEmail: () => '',
      escapeHtml: (value) => String(value || ''),
      showToast() {},
      openConfirmModal: async () => true,
      copyTextToClipboard: async () => {},
    },
    runtime: {
      sendMessage: async (message) => {
        sentMessages.push(message);
        return {
          fileName: `hotmail007-long-lived.${message.payload.format}`,
          fileContent: `content-${message.payload.format}`,
          mimeType: message.payload.format === 'json'
            ? 'application/json;charset=utf-8'
            : (message.payload.format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8'),
          exportedCount: 2,
        };
      },
    },
    constants: {
      copyIcon: '',
      displayTimeZone: 'Asia/Shanghai',
      expandedStorageKey: 'multipage-hotmail-list-expanded',
    },
    hotmailUtils: {},
  });

  manager.bindHotmailEvents();
  await handlers.json();
  await handlers.csv();
  await handlers.txt();

  assert.deepEqual(sentMessages.map((message) => ({
    type: message.type,
    payload: message.payload,
  })), [
    {
      type: 'EXPORT_HOTMAIL007_LONG_LIVED_ACCOUNTS',
      payload: { format: 'json' },
    },
    {
      type: 'EXPORT_HOTMAIL007_LONG_LIVED_ACCOUNTS',
      payload: { format: 'csv' },
    },
    {
      type: 'EXPORT_HOTMAIL007_LONG_LIVED_ACCOUNTS',
      payload: { format: 'txt' },
    },
  ]);
  assert.deepEqual(downloads, [
    {
      content: 'content-json',
      fileName: 'hotmail007-long-lived.json',
      mimeType: 'application/json;charset=utf-8',
    },
    {
      content: 'content-csv',
      fileName: 'hotmail007-long-lived.csv',
      mimeType: 'text/csv;charset=utf-8',
    },
    {
      content: 'content-txt',
      fileName: 'hotmail007-long-lived.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
  ]);
});
