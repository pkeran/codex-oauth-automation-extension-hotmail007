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

test('exportSettingsBundle includes account run history and cost ledger snapshots', async () => {
  const bundle = [
    extractFunction('buildSettingsExportFilename'),
    extractFunction('exportSettingsBundle'),
  ].join('\n');

  const api = new Function(`
const SETTINGS_EXPORT_SCHEMA_VERSION = 1;
const SETTINGS_EXPORT_FILENAME_PREFIX = 'multipage-settings';
const chrome = { runtime: { getManifest: () => ({ version: '4.3' }) } };
async function getPersistedSettings() {
  return { mailProvider: 'hotmail', hotmail007ClientKey: 'client-key-1' };
}
const accountRunHistoryHelpers = {
  getPersistedAccountRunHistory: async () => ([
    { recordId: 'history-1', finalStatus: 'success' },
  ]),
};
async function getPersistedAccountCostLedger() {
  return [
    {
      entryKey: 'mail:hotmail007:hm-1',
      amount: 0.02,
      currency: '',
      status: 'exact',
      outcome: 'consumed',
      createdAt: '2026-05-06T08:00:00.000Z',
    },
  ];
}
${bundle}
return { exportSettingsBundle };
`)();

  const exported = await api.exportSettingsBundle();
  const payload = JSON.parse(exported.fileContent);

  assert.equal(payload.schemaVersion, 1);
  assert.deepStrictEqual(payload.settings, {
    mailProvider: 'hotmail',
    hotmail007ClientKey: 'client-key-1',
  });
  assert.deepStrictEqual(payload.accountRunHistory, [
    { recordId: 'history-1', finalStatus: 'success' },
  ]);
  assert.deepStrictEqual(payload.accountCostLedger, [
    {
      entryKey: 'mail:hotmail007:hm-1',
      amount: 0.02,
      currency: '',
      status: 'exact',
      outcome: 'consumed',
      createdAt: '2026-05-06T08:00:00.000Z',
    },
  ]);
});

test('importSettingsBundle restores account run history and cost ledger snapshots when present', async () => {
  const bundle = [
    extractFunction('importSettingsBundle'),
  ].join('\n');

  const api = new Function(`
const SETTINGS_EXPORT_SCHEMA_VERSION = 1;
const capture = {
  persistedSettings: null,
  sessionUpdates: null,
  broadcastPayload: null,
  importedHistory: null,
  importedLedger: null,
};
async function ensureManualInteractionAllowed() {
  return { stepStatuses: { 1: 'pending' } };
}
async function getState() {
  return { stepStatuses: { 1: 'pending' } };
}
function buildPersistentSettingsPayload(settings) {
  return { ...settings };
}
async function setPersistentSettings(settings) {
  capture.persistedSettings = settings;
}
async function setState(updates) {
  capture.sessionUpdates = updates;
}
function broadcastDataUpdate(payload) {
  capture.broadcastPayload = payload;
}
const accountRunHistoryHelpers = {
  setPersistedAccountRunHistory: async (records) => {
    capture.importedHistory = records;
    return records;
  },
  getPersistedAccountRunHistory: async () => [],
};
async function setPersistedAccountCostLedger(entries) {
  capture.importedLedger = entries;
  return entries;
}
async function getPersistedAccountCostLedger() {
  return [];
}
${bundle}
return { importSettingsBundle, getCapture: () => capture };
`)();

  await api.importSettingsBundle({
    schemaVersion: 1,
    settings: {
      mailProvider: 'hotmail',
      hotmail007ClientKey: 'client-key-1',
    },
    accountRunHistory: [
      { recordId: 'history-1', finalStatus: 'success' },
    ],
    accountCostLedger: [
      {
        entryKey: 'mail:hotmail007:hm-1',
        amount: 0.02,
        currency: '',
        status: 'exact',
        outcome: 'consumed',
        createdAt: '2026-05-06T08:00:00.000Z',
      },
    ],
  });

  const capture = api.getCapture();
  assert.deepStrictEqual(capture.persistedSettings, {
    mailProvider: 'hotmail',
    hotmail007ClientKey: 'client-key-1',
  });
  assert.deepStrictEqual(capture.importedHistory, [
    { recordId: 'history-1', finalStatus: 'success' },
  ]);
  assert.deepStrictEqual(capture.importedLedger, [
    {
      entryKey: 'mail:hotmail007:hm-1',
      amount: 0.02,
      currency: '',
      status: 'exact',
      outcome: 'consumed',
      createdAt: '2026-05-06T08:00:00.000Z',
    },
  ]);
  assert.deepStrictEqual(capture.sessionUpdates.accountRunHistory, capture.importedHistory);
  assert.deepStrictEqual(capture.sessionUpdates.accountCostLedger, capture.importedLedger);
  assert.deepStrictEqual(capture.broadcastPayload.accountRunHistory, capture.importedHistory);
  assert.deepStrictEqual(capture.broadcastPayload.accountCostLedger, capture.importedLedger);
});

test('clearAndBroadcastAccountRunHistory keeps cost ledger intact and clearAndBroadcastAccountCostLedger clears ledger only', async () => {
  const bundle = [
    extractFunction('clearAndBroadcastAccountRunHistory'),
    extractFunction('clearAndBroadcastAccountCostLedger'),
  ].join('\n');

  const api = new Function(`
const capture = {
  historyClears: 0,
  ledgerClears: 0,
  historyBroadcasts: 0,
  ledgerBroadcasts: 0,
};
async function getPersistedAccountCostLedger() {
  return [
    { entryKey: 'mail:1', amount: 0.02, currency: '', status: 'exact', outcome: 'consumed' },
    { entryKey: 'phone:1', amount: 0.05, currency: '', status: 'exact', outcome: 'consumed' },
  ];
}
const accountRunHistoryHelpers = {
  clearAccountRunHistory: async () => {
    capture.historyClears += 1;
    return { clearedCount: 2 };
  },
};
async function clearPersistedAccountCostLedger() {
  capture.ledgerClears += 1;
  return [];
}
async function broadcastAccountRunHistoryUpdate() {
  capture.historyBroadcasts += 1;
  return [];
}
async function broadcastAccountCostLedgerUpdate() {
  capture.ledgerBroadcasts += 1;
  return [];
}
${bundle}
return { clearAndBroadcastAccountRunHistory, clearAndBroadcastAccountCostLedger, getCapture: () => capture };
`)();

  const historyResult = await api.clearAndBroadcastAccountRunHistory({});
  const afterHistory = api.getCapture();
  assert.deepStrictEqual(historyResult, { clearedCount: 2 });
  assert.equal(afterHistory.historyClears, 1);
  assert.equal(afterHistory.ledgerClears, 0);
  assert.equal(afterHistory.historyBroadcasts, 1);
  assert.equal(afterHistory.ledgerBroadcasts, 0);

  const ledgerResult = await api.clearAndBroadcastAccountCostLedger();
  const afterLedger = api.getCapture();
  assert.deepStrictEqual(ledgerResult, { clearedCount: 2 });
  assert.equal(afterLedger.ledgerClears, 1);
  assert.equal(afterLedger.ledgerBroadcasts, 1);
});
