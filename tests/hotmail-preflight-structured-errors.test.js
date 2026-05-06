const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { pickHotmailAccountForRun } = require('../hotmail-utils.js');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    return '';
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let index = start; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = index;
      break;
    }
  }

  if (braceStart < 0) {
    return '';
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

const isAuthorizedHotmailRunAccountSource = extractFunction('isAuthorizedHotmailRunAccount');
const isPendingHotmailVerificationCandidateSource = extractFunction('isPendingHotmailVerificationCandidate');
const compareHotmailAccountAllocationPrioritySource = extractFunction('compareHotmailAccountAllocationPriority');
const pickPendingHotmailAccountForVerificationSource = extractFunction('pickPendingHotmailAccountForVerification');
const ensureHotmailAccountForFlowSource = extractFunction('ensureHotmailAccountForFlow');
const ensureHotmailMailboxReadyForAutoRunRoundSource = extractFunction('ensureHotmailMailboxReadyForAutoRunRound');

function createHotmailPreflightApi(initialState, options = {}) {
  const factory = new Function('deps', `
let currentState = JSON.parse(JSON.stringify(deps.initialState));
const getState = async () => ({
  ...currentState,
  hotmailAccounts: Array.isArray(currentState.hotmailAccounts)
    ? currentState.hotmailAccounts.map((account) => ({ ...account }))
    : [],
});
const normalizeHotmailAccounts = (accounts) => Array.isArray(accounts)
  ? accounts.map((account) => ({ ...account }))
  : [];
const findHotmailAccount = (accounts, accountId) => normalizeHotmailAccounts(accounts)
  .find((account) => account.id === accountId) || null;
const setCurrentHotmailAccount = async (accountId) => {
  const state = await getState();
  const account = findHotmailAccount(state.hotmailAccounts, accountId);
  if (!account) {
    throw new Error('missing Hotmail account');
  }
  currentState = {
    ...currentState,
    currentHotmailAccountId: accountId,
  };
  return account;
};
const pickHotmailAccountForRun = deps.pickHotmailAccountForRun;
const verifyHotmailAccount = async (accountId) => deps.verifyHotmailAccount(accountId, async () => getState());
const maybePurchaseHotmailAccountFromHotmail007 = async (state) => deps.maybePurchaseHotmailAccountFromHotmail007(state, async () => getState());
const isHotmailProvider = (stateOrProvider) => {
  const provider = typeof stateOrProvider === 'string'
    ? stateOrProvider
    : stateOrProvider?.mailProvider;
  return provider === 'hotmail-api';
};
const addLog = async (message, level = 'info') => {
  deps.logs.push({ message, level });
};
const throwIfStopped = () => {};
${isAuthorizedHotmailRunAccountSource}
${isPendingHotmailVerificationCandidateSource}
${compareHotmailAccountAllocationPrioritySource}
${pickPendingHotmailAccountForVerificationSource}
${ensureHotmailAccountForFlowSource}
${ensureHotmailMailboxReadyForAutoRunRoundSource}
return {
  ensureHotmailMailboxReadyForAutoRunRound,
};
  `);

  const logs = [];
  return {
    api: factory({
      initialState,
      logs,
      pickHotmailAccountForRun,
      verifyHotmailAccount: options.verifyImpl || (async () => ({ account: null, messageCount: 0 })),
      maybePurchaseHotmailAccountFromHotmail007: options.purchaseImpl || (async () => null),
    }),
    logs,
  };
}

test('ensureHotmailMailboxReadyForAutoRunRound marks exhausted invalid hotmail candidates with HOTMAIL_ACCOUNT_INVALID', async () => {
  const { api } = createHotmailPreflightApi({
    mailProvider: 'hotmail-api',
    currentHotmailAccountId: 'primary',
    hotmailAccounts: [
      {
        id: 'primary',
        email: 'primary@hotmail.com',
        status: 'authorized',
        refreshToken: 'rt-primary',
        used: false,
        lastUsedAt: 1,
      },
      {
        id: 'backup',
        email: 'backup@hotmail.com',
        status: 'pending',
        refreshToken: 'rt-backup',
        used: false,
        lastUsedAt: 2,
      },
    ],
  }, {
    verifyImpl: async () => {
      throw new Error('refresh token invalid');
    },
  });

  await assert.rejects(
    () => api.ensureHotmailMailboxReadyForAutoRunRound({
      targetRun: 1,
      totalRuns: 2,
      attemptRun: 1,
    }),
    (error) => {
      assert.equal(error.code, 'HOTMAIL_ACCOUNT_INVALID');
      return true;
    }
  );
});
