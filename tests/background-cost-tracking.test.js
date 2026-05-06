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

test('buildRunCostSnapshotFromState combines purchased mail cost with completed phone activation cost', () => {
  const bundle = [
    extractFunction('buildRunCostSnapshotFromState'),
  ].join('\n');

  const api = new Function(`
const HOTMAIL_PROVIDER = 'hotmail';
const LUCKMAIL_PROVIDER = 'luckmail-api';
function isHotmailProvider(state) { return String(state?.mailProvider || '').trim() === HOTMAIL_PROVIDER; }
function isLuckmailProvider(state) { return String(state?.mailProvider || '').trim() === LUCKMAIL_PROVIDER; }
function findHotmailAccount(accounts, accountId) {
  return (Array.isArray(accounts) ? accounts : []).find((account) => account?.id === accountId) || null;
}
function getCurrentLuckmailPurchase(state = {}) {
  return state.currentLuckmailPurchase || null;
}
${bundle}
return { buildRunCostSnapshotFromState };
`)();

  const costs = api.buildRunCostSnapshotFromState({
    mailProvider: 'hotmail',
    currentHotmailAccountId: 'hm-1',
    hotmailAccounts: [
      {
        id: 'hm-1',
        source: 'hotmail007',
        purchaseType: 'hotmail',
        purchasePrice: 0.02,
        purchaseCurrency: '',
        purchaseCostStatus: 'exact',
      },
    ],
    completedPhoneActivation: {
      provider: 'hero-sms',
      activationId: 'act-1',
      phoneNumber: '66880000000',
      countryId: 52,
      price: 0.05,
      priceCurrency: '',
      priceStatus: 'exact',
    },
  });

  assert.deepStrictEqual(costs, {
    mail: {
      provider: 'hotmail007',
      sourceType: 'hotmail',
      amount: 0.02,
      currency: '',
      status: 'exact',
    },
    phone: {
      provider: 'hero-sms',
      countryId: 52,
      amount: 0.05,
      currency: '',
      status: 'exact',
    },
    total: {
      amount: 0.07,
      currency: '',
      status: 'exact',
    },
  });
});

test('buildPhoneActivationCostLedgerEntry keeps refundable providers pending until settlement', () => {
  const bundle = [
    extractFunction('normalizeCostLedgerEntry'),
    extractFunction('normalizeCostOutcome'),
    extractFunction('isPhoneActivationRefundableProvider'),
    extractFunction('resolvePhoneActivationInitialLedgerOutcome'),
    extractFunction('buildPhoneActivationCostLedgerEntry'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { buildPhoneActivationCostLedgerEntry };
`)();

  const heroEntry = api.buildPhoneActivationCostLedgerEntry({
    provider: 'hero-sms',
    activationId: 'hero-1',
    latestActivationId: 'hero-1',
    phoneNumber: '+66800000000',
    price: 0.05,
    priceCurrency: 'USD',
    acquiredAt: 1710000000000,
  }, {
    eventType: 'acquire',
  });
  const fiveSimEntry = api.buildPhoneActivationCostLedgerEntry({
    provider: '5sim',
    activationId: 'five-1',
    latestActivationId: 'five-1',
    phoneNumber: '+84901123456',
    price: 0.08,
    priceCurrency: 'USD',
    acquiredAt: 1710000000001,
  }, {
    eventType: 'acquire',
  });
  const nexEntry = api.buildPhoneActivationCostLedgerEntry({
    provider: 'nexsms',
    activationId: 'nex-1',
    latestActivationId: 'nex-1',
    phoneNumber: '+6281234567890',
    price: 0.07,
    priceCurrency: 'USD',
    acquiredAt: 1710000000002,
  }, {
    eventType: 'acquire',
  });

  assert.equal(heroEntry.outcome, 'pending');
  assert.equal(fiveSimEntry.outcome, 'pending');
  assert.equal(nexEntry.outcome, 'consumed');
});

test('settlePhoneActivationCostLedgerEntries updates the matched pending activation outcome', () => {
  const bundle = [
    extractFunction('normalizeCostLedgerEntry'),
    extractFunction('normalizeAccountCostLedger'),
    extractFunction('normalizeCostOutcome'),
    extractFunction('settlePhoneActivationCostLedgerEntries'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { settlePhoneActivationCostLedgerEntries };
`)();

  const pendingEntryKey = 'phone:hero-sms:hero-1:66800000000:acquire:1710000000000';
  const settled = api.settlePhoneActivationCostLedgerEntries([
    {
      entryKey: pendingEntryKey,
      kind: 'phone_activation',
      provider: 'hero-sms',
      activationId: 'hero-1',
      latestActivationId: 'hero-1',
      phoneNumber: '+66800000000',
      amount: 0.05,
      currency: 'USD',
      status: 'exact',
      outcome: 'pending',
      createdAt: '2026-05-06T08:00:00.000Z',
      eventType: 'acquire',
    },
  ], {
    costLedgerEntryKey: pendingEntryKey,
    provider: 'hero-sms',
    latestActivationId: 'hero-1',
    phoneNumber: '+66800000000',
  }, {
    outcome: 'refunded',
    settledAt: '2026-05-06T08:01:00.000Z',
  });

  assert.equal(settled.length, 1);
  assert.equal(settled[0].outcome, 'refunded');
  assert.equal(settled[0].settledAt, '2026-05-06T08:01:00.000Z');
});

test('buildRunCostSnapshotFromState ignores refunded or pending phone spend and keeps settled mail cost', () => {
  const bundle = [
    extractFunction('buildRunCostSnapshotFromState'),
  ].join('\n');

  const api = new Function(`
const HOTMAIL_PROVIDER = 'hotmail';
const LUCKMAIL_PROVIDER = 'luckmail-api';
function isHotmailProvider(state) { return String(state?.mailProvider || '').trim() === HOTMAIL_PROVIDER; }
function isLuckmailProvider(state) { return String(state?.mailProvider || '').trim() === LUCKMAIL_PROVIDER; }
function findHotmailAccount(accounts, accountId) {
  return (Array.isArray(accounts) ? accounts : []).find((account) => account?.id === accountId) || null;
}
function getCurrentLuckmailPurchase(state = {}) {
  return state.currentLuckmailPurchase || null;
}
${bundle}
return { buildRunCostSnapshotFromState };
`)();

  const costs = api.buildRunCostSnapshotFromState({
    mailProvider: 'hotmail',
    currentHotmailAccountId: 'hm-1',
    hotmailAccounts: [
      {
        id: 'hm-1',
        source: 'hotmail007',
        purchaseType: 'hotmail',
        purchasePrice: 0.02,
        purchaseCurrency: 'USD',
        purchaseCostStatus: 'exact',
      },
    ],
    completedPhoneActivation: {
      provider: 'hero-sms',
      activationId: 'act-1',
      latestActivationId: 'act-1',
      phoneNumber: '66880000000',
      countryId: 52,
      price: 0.05,
      priceCurrency: 'USD',
      priceStatus: 'exact',
      costOutcome: 'refunded',
    },
  });

  assert.deepStrictEqual(costs, {
    mail: {
      provider: 'hotmail007',
      sourceType: 'hotmail',
      amount: 0.02,
      currency: 'USD',
      status: 'exact',
    },
    total: {
      amount: 0.02,
      currency: 'USD',
      status: 'exact',
    },
  });
});

test('summarizeCostLedger groups all consumed spend and computes amortized average', () => {
  const bundle = [
    extractFunction('normalizeCostOutcome'),
    extractFunction('normalizeCostLedgerEntry'),
    extractFunction('summarizeCostLedger'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { normalizeCostLedgerEntry, summarizeCostLedger };
`)();

  const summary = api.summarizeCostLedger([
    {
      entryKey: 'mail:hotmail007:hm-1',
      amount: 0.02,
      currency: '',
      status: 'exact',
      outcome: 'consumed',
    },
    {
      entryKey: 'phone:hero-sms:act-1',
      amount: 0.05,
      currency: '',
      status: 'exact',
      outcome: 'consumed',
    },
    {
      entryKey: 'phone:hero-sms:act-fail-1',
      amount: 0.05,
      currency: '',
      status: 'exact',
      outcome: 'consumed',
    },
  ], { successCount: 2 });

  assert.deepStrictEqual(summary, {
    trackedEntryCount: 3,
    totalByCurrency: [
      {
        currency: '',
        amount: 0.12,
      },
    ],
    averageByCurrency: [
      {
        currency: '',
        amount: 0.06,
      },
    ],
  });
});
