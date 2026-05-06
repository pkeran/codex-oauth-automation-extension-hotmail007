const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => sidepanelSource.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < sidepanelSource.length; i += 1) {
    const ch = sidepanelSource[i];
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
  for (; end < sidepanelSource.length; end += 1) {
    const ch = sidepanelSource[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return sidepanelSource.slice(start, end);
}

function createClassList() {
  const classNames = new Set();
  return {
    add(...values) {
      values.forEach((value) => classNames.add(String(value)));
    },
    remove(...values) {
      values.forEach((value) => classNames.delete(String(value)));
    },
    toggle(value, force) {
      const key = String(value);
      if (force === undefined) {
        if (classNames.has(key)) {
          classNames.delete(key);
          return false;
        }
        classNames.add(key);
        return true;
      }
      if (force) {
        classNames.add(key);
        return true;
      }
      classNames.delete(key);
      return false;
    },
    contains(value) {
      return classNames.has(String(value));
    },
    toString() {
      return Array.from(classNames).join(' ');
    },
  };
}

function createNode(initial = {}) {
  return {
    innerHTML: '',
    textContent: '',
    hidden: false,
    disabled: false,
    listeners: {},
    attributes: {},
    dataset: {},
    classList: createClassList(),
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    ...initial,
  };
}

function createClosestTarget(matches = {}, checked) {
  return {
    checked,
    closest(selector) {
      return matches[selector] || null;
    },
  };
}

function createDataNode(attrName, attrValue) {
  return {
    dataset: {},
    getAttribute(name) {
      return name === attrName ? attrValue : '';
    },
  };
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('sidepanel html separates account records overlay from cost ledger overlay and loads both managers', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const recordsManagerIndex = html.indexOf('<script src="account-records-manager.js"></script>');
  const ledgerManagerIndex = html.indexOf('<script src="account-cost-ledger-manager.js"></script>');
  const sidepanelIndex = html.indexOf('<script src="sidepanel.js"></script>');
  const recordsOverlayMatch = html.match(/<div id="account-records-overlay"[\s\S]*?<\/div>\s*<\/div>/);

  assert.match(html, /id="btn-open-account-records"/);
  assert.match(html, /id="btn-open-account-cost-ledger"/);
  assert.match(html, /id="account-records-overlay"/);
  assert.match(html, /id="account-cost-ledger-overlay"/);
  assert.match(html, /id="account-records-list"/);
  assert.match(html, /id="account-records-stats"/);
  assert.match(html, /id="btn-clear-account-records"/);
  assert.match(html, /id="btn-toggle-account-records-selection"/);
  assert.match(html, /id="btn-delete-selected-account-records"/);
  assert.match(html, /id="account-cost-ledger-summary"/);
  assert.match(html, /id="account-cost-ledger-daily-list"/);
  assert.match(html, /id="btn-clear-account-cost-ledger"/);
  assert.match(html, /id="input-sub2api-default-proxy"/);
  assert.match(html, /src="editable-list-picker\.js"/);
  assert.match(html, /id="sub2api-group-picker"/);
  assert.match(html, /id="input-sub2api-group" value="codex"/);
  assert.match(html, /id="btn-add-sub2api-group"/);
  assert.match(html, /id="paypal-account-picker"/);
  assert.match(html, /id="cf-domain-picker"/);
  assert.match(html, /id="temp-email-domain-picker"/);
  assert.ok(recordsOverlayMatch, 'missing account records overlay block');
  assert.doesNotMatch(recordsOverlayMatch[0], /account-records-daily-costs/);
  assert.doesNotMatch(recordsOverlayMatch[0], /btn-clear-account-cost-ledger/);
  assert.notEqual(recordsManagerIndex, -1);
  assert.notEqual(ledgerManagerIndex, -1);
  assert.notEqual(sidepanelIndex, -1);
  assert.ok(recordsManagerIndex < ledgerManagerIndex);
  assert.ok(ledgerManagerIndex < sidepanelIndex);
});

test('sidepanel css keeps confirm modal above account records overlay', () => {
  const css = fs.readFileSync('sidepanel/sidepanel.css', 'utf8');
  const overlayMatch = css.match(/\.account-records-overlay\s*\{[\s\S]*?z-index:\s*(\d+);/);
  const modalMatch = css.match(/\.modal-overlay\s*\{[\s\S]*?z-index:\s*(\d+);/);

  assert.ok(overlayMatch, 'missing account records overlay z-index');
  assert.ok(modalMatch, 'missing modal overlay z-index');
  assert.ok(Number(modalMatch[1]) > Number(overlayMatch[1]));
});

test('sidepanel account records helper normalizes snapshot helper base url', () => {
  const bundle = [
    extractFunction('normalizeAccountRunHistoryHelperBaseUrlValue'),
  ].join('\n');

  const api = new Function(`
const DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL = 'http://127.0.0.1:17373';
${bundle}
return { normalizeAccountRunHistoryHelperBaseUrlValue };
`)();

  assert.equal(
    api.normalizeAccountRunHistoryHelperBaseUrlValue('http://127.0.0.1:17373/sync-account-run-records'),
    'http://127.0.0.1:17373'
  );
});

test('account records manager supports filter chips and partial multi-select delete', async () => {
  const source = fs.readFileSync('sidepanel/account-records-manager.js', 'utf8');
  const windowObject = {};
  const api = new Function('window', `${source}; return window.SidepanelAccountRecordsManager;`)(windowObject);

  assert.equal(typeof api?.createAccountRecordsManager, 'function');

  let latestState = {
    accountRunHistory: [
      {
        recordId: 'success@example.com',
        email: 'success@example.com',
        password: 'secret',
        finalStatus: 'success',
        finishedAt: '2026-04-17T04:31:00.000Z',
        retryCount: 0,
        failureLabel: '娴佺▼瀹屾垚',
      },
      {
        recordId: 'failed@example.com',
        email: 'failed@example.com',
        password: 'secret',
        finalStatus: 'failed',
        finishedAt: '2026-04-17T04:29:00.000Z',
        retryCount: 2,
        failureLabel: '手机号码验证失败',
      },
      {
        recordId: 'stopped@example.com',
        email: 'stopped@example.com',
        password: 'secret',
        finalStatus: 'stopped',
        finishedAt: '2026-04-17T04:28:00.000Z',
        retryCount: 1,
        failureLabel: '姝ラ 7 鍋滄',
      },
    ],
  };

  const btnOpenAccountRecords = createNode();
  const btnCloseAccountRecords = createNode();
  const btnClearAccountRecords = createNode();
  const btnClearAccountCostLedger = createNode();
  const btnToggleAccountRecordsSelection = createNode();
  const btnDeleteSelectedAccountRecords = createNode({ hidden: true, disabled: true });
  const btnAccountRecordsPrev = createNode();
  const btnAccountRecordsNext = createNode();
  const overlay = createNode();
  const list = createNode();
  const daily = createNode();
  const stats = createNode();
  const meta = createNode();
  const pageLabel = createNode();
  const messages = [];
  const toasts = [];
  let manager = null;

  manager = api.createAccountRecordsManager({
    state: {
      getLatestState: () => latestState,
      syncLatestState(nextState) {
        latestState = {
          ...latestState,
          ...(nextState || {}),
        };
        manager.render(latestState);
      },
    },
    dom: {
      accountRecordsList: list,
      accountRecordsDailyCosts: daily,
      accountRecordsMeta: meta,
      accountRecordsOverlay: overlay,
      accountRecordsPageLabel: pageLabel,
      accountRecordsStats: stats,
      btnAccountRecordsNext,
      btnAccountRecordsPrev,
      btnClearAccountRecords,
      btnClearAccountCostLedger,
      btnCloseAccountRecords,
      btnDeleteSelectedAccountRecords,
      btnOpenAccountRecords,
      btnToggleAccountRecordsSelection,
    },
    helpers: {
      escapeHtml: (value) => String(value || ''),
      openConfirmModal: async () => true,
      showToast(message, tone) {
        toasts.push({ message, tone });
      },
    },
    runtime: {
      sendMessage: async (message) => {
        messages.push(message);
        if (message.type === 'DELETE_ACCOUNT_RUN_HISTORY_RECORDS') {
          return {
            deletedCount: message.payload.recordIds.length,
            remainingCount: 2,
          };
        }
        if (message.type === 'CLEAR_ACCOUNT_RUN_HISTORY') {
          return {
            clearedCount: latestState.accountRunHistory.length,
          };
        }
        return {};
      },
    },
    constants: {
      displayTimeZone: 'Asia/Shanghai',
      pageSize: 10,
    },
  });

  manager.bindEvents();
  manager.render();

  assert.equal(meta.textContent.includes('3'), true);
  assert.match(stats.innerHTML, /data-account-record-filter="retry"/);
  assert.match(list.innerHTML, /success@example\.com/);
  assert.match(list.innerHTML, /failed@example\.com/);
  assert.equal(pageLabel.textContent, '1 / 1');
  assert.equal(btnDeleteSelectedAccountRecords.hidden, true);

  stats.listeners.click({
    target: createClosestTarget({
      '[data-account-record-filter]': createDataNode('data-account-record-filter', 'retry'),
    }),
  });

  assert.equal(meta.textContent.includes('2'), true);
  assert.doesNotMatch(list.innerHTML, /success@example\.com/);
  assert.match(list.innerHTML, /failed@example\.com/);
  assert.match(list.innerHTML, /stopped@example\.com/);
  assert.equal(list.innerHTML.includes('stopped@example.com'), true);

  btnToggleAccountRecordsSelection.listeners.click();

  assert.equal(btnDeleteSelectedAccountRecords.hidden, false);
  assert.equal(btnClearAccountRecords.hidden, true);
  assert.equal(btnDeleteSelectedAccountRecords.disabled, true);
  assert.equal(btnToggleAccountRecordsSelection.textContent.includes('取消'), true);

  list.listeners.click({
    target: createClosestTarget({
      '[data-account-record-toggle]': null,
      '[data-account-record-id]': createDataNode('data-account-record-id', 'failed@example.com'),
    }),
  });

  assert.equal(btnDeleteSelectedAccountRecords.disabled, false);
  assert.match(btnDeleteSelectedAccountRecords.textContent, /1/);
  assert.match(list.innerHTML, /data-account-record-checkbox="failed@example\.com"[^>]*checked/);

  await btnDeleteSelectedAccountRecords.listeners.click();
  await flushPromises();

  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'DELETE_ACCOUNT_RUN_HISTORY_RECORDS');
  assert.deepStrictEqual(messages[0].payload.recordIds, ['failed@example.com']);
  assert.equal(latestState.accountRunHistory.length, 2);
  assert.equal(latestState.accountRunHistory.some((item) => item.email === 'failed@example.com'), false);
  assert.equal(meta.textContent.includes('1'), true);
  assert.doesNotMatch(list.innerHTML, /failed@example\.com/);
  assert.match(list.innerHTML, /stopped@example\.com/);
  assert.equal(btnDeleteSelectedAccountRecords.disabled, true);
  assert.equal(toasts.at(-1)?.tone, 'success');
  assert.equal(String(toasts.at(-1)?.message || '').includes('1'), true);
});

test('account records manager keeps per-record cost lines but no longer renders ledger summary chips', () => {
  const source = fs.readFileSync('sidepanel/account-records-manager.js', 'utf8');
  const windowObject = {};
  const api = new Function('window', `${source}; return window.SidepanelAccountRecordsManager;`)(windowObject);

  const list = createNode();
  const meta = createNode();
  const stats = createNode();
  const manager = api.createAccountRecordsManager({
    state: {
      getLatestState: () => ({
        accountRunHistory: [
          {
            recordId: 'cost-success@example.com',
            email: 'cost-success@example.com',
            password: 'secret',
            finalStatus: 'success',
            finishedAt: '2026-05-06T08:00:00.000Z',
            retryCount: 0,
            failureLabel: '娴佺▼瀹屾垚',
            costs: {
              mail: { provider: 'hotmail007', amount: 0.02, currency: '', status: 'exact' },
              phone: { provider: 'hero-sms', amount: 0.05, currency: '', status: 'exact', countryId: 52 },
              total: { amount: 0.07, currency: '', status: 'exact' },
            },
          },
          {
            recordId: 'cost-failed@example.com',
            email: 'cost-failed@example.com',
            password: 'secret',
            finalStatus: 'failed',
            finishedAt: '2026-05-06T07:00:00.000Z',
            retryCount: 1,
            failureLabel: '手机号码验证失败',
          },
        ],
        accountCostLedger: [
          {
            entryKey: 'mail:hotmail007:hm-1',
            amount: 0.02,
            currency: '',
            status: 'exact',
            outcome: 'consumed',
          },
          {
            entryKey: 'phone:hero-sms:act-success',
            amount: 0.05,
            currency: '',
            status: 'exact',
            outcome: 'consumed',
          },
          {
            entryKey: 'phone:hero-sms:act-failed',
            amount: 0.05,
            currency: '',
            status: 'exact',
            outcome: 'consumed',
          },
        ],
      }),
      syncLatestState() {},
    },
    dom: {
      accountRecordsList: list,
      accountRecordsMeta: meta,
      accountRecordsOverlay: createNode(),
      accountRecordsPageLabel: createNode(),
      accountRecordsStats: stats,
      btnAccountRecordsNext: createNode(),
      btnAccountRecordsPrev: createNode(),
      btnClearAccountRecords: createNode(),
      btnClearAccountCostLedger: createNode(),
      btnCloseAccountRecords: createNode(),
      btnDeleteSelectedAccountRecords: createNode(),
      btnOpenAccountRecords: createNode(),
      btnToggleAccountRecordsSelection: createNode(),
    },
    helpers: {
      escapeHtml: (value) => String(value || ''),
    },
    runtime: {
      sendMessage: async () => ({}),
    },
    constants: {
      displayTimeZone: 'Asia/Shanghai',
      pageSize: 10,
    },
  });

  manager.render();

  assert.doesNotMatch(stats.innerHTML, /成功总成本/);
  assert.doesNotMatch(stats.innerHTML, /成功平均成本/);
  assert.doesNotMatch(stats.innerHTML, /全部消耗总成本/);
  assert.doesNotMatch(stats.innerHTML, /成功摊销平均成本/);
  assert.match(list.innerHTML, /总成本/);
  assert.match(list.innerHTML, /邮箱 0\.0200/);
  assert.match(list.innerHTML, /手机 0\.0500/);
});

test('account records manager displays phone-only records with account identifier fallback', () => {
  const source = fs.readFileSync('sidepanel/account-records-manager.js', 'utf8');
  const windowObject = {};
  const api = new Function('window', `${source}; return window.SidepanelAccountRecordsManager;`)(windowObject);

  const list = createNode();
  const meta = createNode();
  const manager = api.createAccountRecordsManager({
    state: {
      getLatestState: () => ({
        accountRunHistory: [
          {
            recordId: 'phone:+6612345',
            accountIdentifierType: 'phone',
            accountIdentifier: '+6612345',
            phoneNumber: '+6612345',
            email: '',
            password: '',
            finalStatus: 'success',
            finishedAt: '2026-04-17T04:31:00.000Z',
            retryCount: 0,
            failureLabel: '娴佺▼瀹屾垚',
          },
        ],
      }),
      syncLatestState() {},
    },
    dom: {
      accountRecordsList: list,
      accountRecordsMeta: meta,
      accountRecordsOverlay: createNode(),
      accountRecordsPageLabel: createNode(),
      accountRecordsStats: createNode(),
      btnAccountRecordsNext: createNode(),
      btnAccountRecordsPrev: createNode(),
      btnClearAccountRecords: createNode(),
      btnCloseAccountRecords: createNode(),
      btnDeleteSelectedAccountRecords: createNode(),
      btnOpenAccountRecords: createNode(),
      btnToggleAccountRecordsSelection: createNode(),
    },
    helpers: {
      escapeHtml: (value) => String(value || ''),
    },
    runtime: {
      sendMessage: async () => ({}),
    },
    constants: {
      displayTimeZone: 'Asia/Shanghai',
      pageSize: 10,
    },
  });

  manager.render();

  assert.equal(meta.textContent.includes('1'), true);
  assert.match(list.innerHTML, /\+6612345/);
  assert.doesNotMatch(list.innerHTML, /account-record-item-secondary/);
});

test('account records manager displays combined email and phone identities in one record', () => {
  const source = fs.readFileSync('sidepanel/account-records-manager.js', 'utf8');
  const windowObject = {};
  const api = new Function('window', `${source}; return window.SidepanelAccountRecordsManager;`)(windowObject);

  const list = createNode();
  const manager = api.createAccountRecordsManager({
    state: {
      getLatestState: () => ({
        accountRunHistory: [
          {
            recordId: 'phone:+447700900123',
            accountIdentifierType: 'phone',
            accountIdentifier: '+447700900123',
            phoneNumber: '+447700900123',
            email: 'bound@example.com',
            finalStatus: 'success',
            finishedAt: '2026-04-17T04:31:00.000Z',
            retryCount: 0,
            failureLabel: '娴佺▼瀹屾垚',
          },
          {
            recordId: 'mail@example.com',
            accountIdentifierType: 'email',
            accountIdentifier: 'mail@example.com',
            phoneNumber: '447799342687',
            email: 'mail@example.com',
            finalStatus: 'failed',
            finishedAt: '2026-04-17T04:30:00.000Z',
            retryCount: 0,
            failureLabel: '姝ラ 9 澶辫触',
          },
        ],
      }),
      syncLatestState() {},
    },
    dom: {
      accountRecordsList: list,
      accountRecordsMeta: createNode(),
      accountRecordsOverlay: createNode(),
      accountRecordsPageLabel: createNode(),
      accountRecordsStats: createNode(),
      btnAccountRecordsNext: createNode(),
      btnAccountRecordsPrev: createNode(),
      btnClearAccountRecords: createNode(),
      btnCloseAccountRecords: createNode(),
      btnDeleteSelectedAccountRecords: createNode(),
      btnOpenAccountRecords: createNode(),
      btnToggleAccountRecordsSelection: createNode(),
    },
    helpers: {
      escapeHtml: (value) => String(value || ''),
    },
    runtime: {
      sendMessage: async () => ({}),
    },
    constants: {
      displayTimeZone: 'Asia/Shanghai',
      pageSize: 10,
    },
  });

  manager.render();

  assert.match(list.innerHTML, /\+447700900123/);
  assert.match(list.innerHTML, /邮箱 bound@example\.com/);
  assert.match(list.innerHTML, /mail@example\.com/);
  assert.match(list.innerHTML, /绑定手机号 447799342687/);
  assert.match(
    list.innerHTML,
    /title="\+447700900123 \/ 邮箱 bound@example\.com"/
  );
});
