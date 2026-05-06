const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

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

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

test('account cost ledger manager renders daily ledger groups and clears cost ledger independently', async () => {
  const source = fs.readFileSync('sidepanel/account-cost-ledger-manager.js', 'utf8');
  const windowObject = {};
  const api = new Function('window', `${source}; return window.SidepanelAccountCostLedgerManager;`)(windowObject);

  let latestState = {
    accountRunHistory: [
      {
        recordId: 'day-success-1@example.com',
        email: 'day-success-1@example.com',
        finalStatus: 'success',
        finishedAt: '2026-05-06T08:00:00.000Z',
        retryCount: 0,
        failureLabel: 'success',
        costs: {
          total: { amount: 0.07, currency: '', status: 'exact' },
        },
      },
      {
        recordId: 'day-success-2@example.com',
        email: 'day-success-2@example.com',
        finalStatus: 'success',
        finishedAt: '2026-05-05T08:00:00.000Z',
        retryCount: 0,
        failureLabel: 'success',
        costs: {
          total: { amount: 0.05, currency: '', status: 'exact' },
        },
      },
    ],
    accountCostLedger: [
      {
        entryKey: 'mail:day-1',
        amount: 0.02,
        currency: '',
        status: 'exact',
        outcome: 'consumed',
        createdAt: '2026-05-06T08:10:00.000Z',
      },
      {
        entryKey: 'phone:day-1',
        amount: 0.05,
        currency: '',
        status: 'exact',
        outcome: 'consumed',
        createdAt: '2026-05-06T08:12:00.000Z',
      },
      {
        entryKey: 'phone:day-2',
        amount: 0.05,
        currency: '',
        status: 'exact',
        outcome: 'consumed',
        createdAt: '2026-05-05T08:12:00.000Z',
      },
    ],
  };

  assert.equal(typeof api?.createAccountCostLedgerManager, 'function');

  const summary = createNode();
  const daily = createNode();
  const meta = createNode();
  const overlay = createNode();
  const btnOpenAccountCostLedger = createNode();
  const btnCloseAccountCostLedger = createNode();
  const btnClearAccountCostLedger = createNode();
  const messages = [];
  const toasts = [];
  let manager = null;

  manager = api.createAccountCostLedgerManager({
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
      accountCostLedgerSummary: summary,
      accountCostLedgerDailyList: daily,
      accountCostLedgerMeta: meta,
      accountCostLedgerOverlay: overlay,
      btnOpenAccountCostLedger,
      btnCloseAccountCostLedger,
      btnClearAccountCostLedger,
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
        if (message.type === 'CLEAR_ACCOUNT_COST_LEDGER') {
          return {
            clearedCount: latestState.accountCostLedger.length,
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

  assert.match(summary.innerHTML, /0\.1200/);
  assert.match(summary.innerHTML, /0\.0600/);
  assert.match(daily.innerHTML, /2026-05-06/);
  assert.match(daily.innerHTML, /2026-05-05/);
  assert.match(daily.innerHTML, /0\.0700/);
  assert.match(daily.innerHTML, /0\.0500/);

  await btnClearAccountCostLedger.listeners.click();
  await flushPromises();

  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'CLEAR_ACCOUNT_COST_LEDGER');
  assert.equal(latestState.accountRunHistory.length, 2);
  assert.deepStrictEqual(latestState.accountCostLedger, []);
  assert.match(daily.innerHTML, /0\.0000|鏆傛棤/);
  assert.deepStrictEqual(toasts.at(-1), {
    message: 'Cleared 3 cost ledger entries.',
    tone: 'success',
  });
});
