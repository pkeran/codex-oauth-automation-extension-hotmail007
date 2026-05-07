const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (!Number.isInteger(start) || start < 0) {
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

test('exportHotmail007LongLivedAccounts only exports hotmail007 long-lived accounts and keeps catalog metadata', async () => {
  const bundle = [
    extractFunction('normalizeHotmailAccountSource'),
    extractFunction('normalizeHotmailAccount'),
    extractFunction('normalizeHotmailAccounts'),
    extractFunction('buildSettingsExportFilename'),
    extractFunction('buildHotmail007LongLivedExportFilename'),
    extractFunction('normalizeHotmail007LongLivedExportFormat'),
    extractFunction('isHotmail007LongLivedAccount'),
    extractFunction('escapeCsvCell'),
    extractFunction('serializeHotmail007LongLivedAccounts'),
    extractFunction('exportHotmail007LongLivedAccounts'),
  ].join('\n');

  const api = new Function(`
const SETTINGS_EXPORT_FILENAME_PREFIX = 'multipage-settings';
const HOTMAIL_ACCOUNT_SOURCE_HOTMAIL007 = 'hotmail007';
const HOTMAIL_ACCOUNT_SOURCE_MANUAL = 'manual';
const chrome = { runtime: { getManifest: () => ({ version: '5.5' }) } };
function normalizeHotmail007MailType(value = '') {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}
async function getPersistedSettings() {
  return {
    hotmailAccounts: [
      {
        id: 'hm-1',
        email: 'trusted-graph@hotmail.com',
        password: 'pw-1',
        clientId: 'client-1',
        refreshToken: 'refresh-1',
        source: 'hotmail007',
        purchaseType: 'hotmail Trusted Graph',
        catalogLive: '3-6+ Months',
        catalogAccess: '1',
        catalogStockSnapshot: 10782,
        purchasePrice: 0.02,
        purchaseCurrency: 'USD',
        purchasedAt: 1710000000000,
        status: 'authorized',
        used: false,
      },
      {
        id: 'hm-2',
        email: 'legacy-trusted@outlook.com',
        password: 'pw-2',
        clientId: 'client-2',
        refreshToken: 'refresh-2',
        source: 'hotmail007',
        purchaseType: 'outlook Trusted',
        purchasePrice: 0.02,
        purchaseCurrency: 'USD',
        purchasedAt: 1710000000001,
        status: 'pending',
        used: true,
      },
      {
        id: 'hm-3',
        email: 'short-lived@hotmail.com',
        password: 'pw-3',
        clientId: 'client-3',
        refreshToken: 'refresh-3',
        source: 'hotmail007',
        purchaseType: 'hotmail-premium',
        catalogLive: '1-3 Hours',
      },
      {
        id: 'hm-4',
        email: 'manual-trusted@hotmail.com',
        password: 'pw-4',
        clientId: 'client-4',
        refreshToken: 'refresh-4',
        source: 'manual',
        purchaseType: 'hotmail Trusted Graph',
        catalogLive: '3-6+ Months',
      },
    ],
  };
}
${bundle}
return { exportHotmail007LongLivedAccounts };
`)();

  const exported = await api.exportHotmail007LongLivedAccounts({ format: 'json' });
  const payload = JSON.parse(exported.fileContent);

  assert.equal(exported.mimeType, 'application/json;charset=utf-8');
  assert.match(exported.fileName, /^hotmail007-long-lived-accounts-\d{8}-\d{6}\.json$/);
  assert.equal(exported.exportedCount, 2);
  assert.deepStrictEqual(payload.accounts, [
    {
      accountId: 'hm-1',
      email: 'trusted-graph@hotmail.com',
      password: 'pw-1',
      clientId: 'client-1',
      refreshToken: 'refresh-1',
      source: 'hotmail007',
      purchaseType: 'hotmail Trusted Graph',
      catalogLive: '3-6+ Months',
      catalogAccess: '1',
      catalogStockSnapshot: 10782,
      purchasePrice: 0.02,
      purchaseCurrency: 'USD',
      purchaseCostStatus: 'exact',
      purchaseBatchId: '',
      purchasedAt: 1710000000000,
      status: 'authorized',
      used: false,
      lastAuthAt: 0,
      lastUsedAt: 0,
      lastError: '',
    },
    {
      accountId: 'hm-2',
      email: 'legacy-trusted@outlook.com',
      password: 'pw-2',
      clientId: 'client-2',
      refreshToken: 'refresh-2',
      source: 'hotmail007',
      purchaseType: 'outlook Trusted',
      catalogLive: '',
      catalogAccess: '',
      catalogStockSnapshot: '',
      purchasePrice: 0.02,
      purchaseCurrency: 'USD',
      purchaseCostStatus: 'exact',
      purchaseBatchId: '',
      purchasedAt: 1710000000001,
      status: 'pending',
      used: true,
      lastAuthAt: 0,
      lastUsedAt: 0,
      lastError: '',
    },
  ]);
});

test('exportHotmail007LongLivedAccounts serializes csv and txt formats', async () => {
  const bundle = [
    extractFunction('normalizeHotmailAccountSource'),
    extractFunction('normalizeHotmailAccount'),
    extractFunction('normalizeHotmailAccounts'),
    extractFunction('buildSettingsExportFilename'),
    extractFunction('buildHotmail007LongLivedExportFilename'),
    extractFunction('normalizeHotmail007LongLivedExportFormat'),
    extractFunction('isHotmail007LongLivedAccount'),
    extractFunction('escapeCsvCell'),
    extractFunction('serializeHotmail007LongLivedAccounts'),
    extractFunction('exportHotmail007LongLivedAccounts'),
  ].join('\n');

  const api = new Function(`
const SETTINGS_EXPORT_FILENAME_PREFIX = 'multipage-settings';
const HOTMAIL_ACCOUNT_SOURCE_HOTMAIL007 = 'hotmail007';
const HOTMAIL_ACCOUNT_SOURCE_MANUAL = 'manual';
const chrome = { runtime: { getManifest: () => ({ version: '5.5' }) } };
function normalizeHotmail007MailType(value = '') {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}
async function getPersistedSettings() {
  return {
    hotmailAccounts: [
      {
        id: 'hm-1',
        email: 'trusted-graph@hotmail.com',
        password: 'pw-1',
        clientId: 'client-1',
        refreshToken: 'refresh-1',
        source: 'hotmail007',
        purchaseType: 'hotmail Trusted Graph',
        catalogLive: '3-6+ Months',
        catalogAccess: '1',
        catalogStockSnapshot: 10782,
        purchasePrice: 0.02,
        purchaseCurrency: 'USD',
      },
    ],
  };
}
${bundle}
return { exportHotmail007LongLivedAccounts };
`)();

  const csvExport = await api.exportHotmail007LongLivedAccounts({ format: 'csv' });
  const txtExport = await api.exportHotmail007LongLivedAccounts({ format: 'txt' });

  assert.equal(csvExport.mimeType, 'text/csv;charset=utf-8');
  assert.match(csvExport.fileContent, /accountId,email,password,clientId,refreshToken,source,purchaseType,catalogLive,catalogAccess,catalogStockSnapshot/);
  assert.match(csvExport.fileContent, /hm-1,trusted-graph@hotmail\.com,pw-1,client-1,refresh-1,hotmail007,hotmail Trusted Graph,3-6\+ Months,1,10782/);

  assert.equal(txtExport.mimeType, 'text/plain;charset=utf-8');
  assert.match(txtExport.fileContent, /账号 1/);
  assert.match(txtExport.fileContent, /邮箱: trusted-graph@hotmail\.com/);
  assert.match(txtExport.fileContent, /有效期: 3-6\+ Months/);
  assert.match(txtExport.fileContent, /库存快照: 10782/);
});

test('purchaseHotmailAccountsFromHotmail007 persists selected catalog metadata onto saved accounts', async () => {
  const bundle = [
    extractFunction('purchaseHotmailAccountsFromHotmail007'),
  ].join('\n');

  const api = new Function(`
const HOTMAIL_ACCOUNT_SOURCE_HOTMAIL007 = 'hotmail007';
const captures = { savedAccounts: null };
const crypto = { randomUUID: () => 'batch-uuid-1' };
Date.now = () => 1710000000000;
async function resolveHotmail007PurchaseUnitCost() {
  return {
    payload: {
      data: ['trusted-graph@hotmail.com:pw-1:refresh-1:client-1'],
    },
    exactTotalSpent: 0.02,
    unitPrice: 0.02,
    mailType: 'hotmail Trusted Graph',
    currency: 'USD',
    costStatus: 'exact',
  };
}
function parseHotmail007AccountString(rawValue) {
  const [email, password, refreshToken, clientId] = String(rawValue || '').split(':');
  return { email, password, refreshToken, clientId };
}
function normalizeHotmail007MailType(value = '') {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}
async function fetchHotmail007MailPriceList() {
  return {
    entries: [
      {
        type: 'hotmail Trusted Graph',
        live: '3-6+ Months',
        access: '1',
        stock: 10782,
      },
    ],
  };
}
async function upsertHotmailAccounts(accounts) {
  captures.savedAccounts = accounts;
  return accounts.map((account, index) => ({ ...account, id: account.id || ('hm-' + (index + 1)) }));
}
function buildHotmailAccountCostLedgerEntry() {
  return null;
}
async function appendAccountCostLedgerEntries() {}
${bundle}
return { purchaseHotmailAccountsFromHotmail007, captures };
`)();

  await api.purchaseHotmailAccountsFromHotmail007({
    clientKey: 'client-key-1',
    mailType: 'hotmail Trusted Graph',
    quantity: 1,
  });

  assert.deepStrictEqual(api.captures.savedAccounts, [
    {
      email: 'trusted-graph@hotmail.com',
      password: 'pw-1',
      refreshToken: 'refresh-1',
      clientId: 'client-1',
      source: 'hotmail007',
      purchaseType: 'hotmail Trusted Graph',
      status: 'pending',
      used: false,
      lastError: '',
      purchasePrice: 0.02,
      purchaseCurrency: 'USD',
      purchaseCostStatus: 'exact',
      purchasedAt: 1710000000000,
      purchaseBatchId: 'batch-uuid-1',
      catalogLive: '3-6+ Months',
      catalogAccess: '1',
      catalogStockSnapshot: 10782,
    },
  ]);
});
