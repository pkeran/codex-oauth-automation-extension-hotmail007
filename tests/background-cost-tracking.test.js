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

test('summarizeCostLedger groups all consumed spend and computes amortized average', () => {
  const bundle = [
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
