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

const requestHotmail007PurchasePayloadSource = extractFunction('requestHotmail007PurchasePayload');
const requestHotmailLocalMessagesSource = extractFunction('requestHotmailLocalMessages');

function createHotmailStructuredApi(deps = {}) {
  const factory = new Function('deps', `
const HOTMAIL007_AUTO_PURCHASE_QUANTITY = deps.HOTMAIL007_AUTO_PURCHASE_QUANTITY ?? 1;
const HOTMAIL_MAILBOXES = deps.HOTMAIL_MAILBOXES || ["INBOX", "Junk"];
const HOTMAIL_LOCAL_HELPER_TIMEOUT_MS = deps.HOTMAIL_LOCAL_HELPER_TIMEOUT_MS ?? 45000;
const normalizeHotmail007MailType = deps.normalizeHotmail007MailType;
const fetchHotmail007StockCount = deps.fetchHotmail007StockCount;
const buildHotmail007StockUnavailableMessage = deps.buildHotmail007StockUnavailableMessage;
const buildHotmail007GetMailUrl = deps.buildHotmail007GetMailUrl;
const resolveHotmail007PurchaseFailureMessage = deps.resolveHotmail007PurchaseFailureMessage;
const fetch = deps.fetch;
const AbortController = deps.AbortController;
const setTimeout = deps.setTimeout;
const clearTimeout = deps.clearTimeout;
const getState = deps.getState;
const getHotmailServiceSettings = deps.getHotmailServiceSettings;
const getHotmailMailApiRequestConfig = deps.getHotmailMailApiRequestConfig;
const buildHotmailLocalEndpoint = deps.buildHotmailLocalEndpoint;
${requestHotmail007PurchasePayloadSource}
${requestHotmailLocalMessagesSource}
return {
  requestHotmail007PurchasePayload,
  requestHotmailLocalMessages,
};
  `);

  return factory({
    HOTMAIL007_AUTO_PURCHASE_QUANTITY: deps.HOTMAIL007_AUTO_PURCHASE_QUANTITY,
    HOTMAIL_MAILBOXES: deps.HOTMAIL_MAILBOXES,
    HOTMAIL_LOCAL_HELPER_TIMEOUT_MS: deps.HOTMAIL_LOCAL_HELPER_TIMEOUT_MS,
    normalizeHotmail007MailType: deps.normalizeHotmail007MailType || ((value) => value || 'OUTLOOK'),
    fetchHotmail007StockCount: deps.fetchHotmail007StockCount || (async () => null),
    buildHotmail007StockUnavailableMessage: deps.buildHotmail007StockUnavailableMessage || (() => 'Hotmail007 当前无库存'),
    buildHotmail007GetMailUrl: deps.buildHotmail007GetMailUrl || (() => 'https://hotmail007.test/get'),
    resolveHotmail007PurchaseFailureMessage: deps.resolveHotmail007PurchaseFailureMessage || (async () => null),
    fetch: deps.fetch || (async () => ({
      ok: true,
      text: async () => JSON.stringify({ code: 0, data: [] }),
    })),
    AbortController: deps.AbortController || AbortController,
    setTimeout: deps.setTimeout || global.setTimeout,
    clearTimeout: deps.clearTimeout || global.clearTimeout,
    getState: deps.getState || (async () => ({})),
    getHotmailServiceSettings: deps.getHotmailServiceSettings || (() => ({ localBaseUrl: 'http://127.0.0.1:17373' })),
    getHotmailMailApiRequestConfig: deps.getHotmailMailApiRequestConfig || (() => ({ timeoutMs: 1000 })),
    buildHotmailLocalEndpoint: deps.buildHotmailLocalEndpoint || ((baseUrl, path) => `${baseUrl}${path}`),
  });
}

test('Hotmail007 purchase marks stock exhaustion with HOTMAIL007_NO_STOCK', async () => {
  const api = createHotmailStructuredApi({
    fetchHotmail007StockCount: async () => 0,
    fetch: async () => {
      throw new Error('fetch should not be called when stock is already insufficient');
    },
  });

  await assert.rejects(
    () => api.requestHotmail007PurchasePayload({
      clientKey: 'client-key',
      mailType: 'OUTLOOK',
      quantity: 1,
    }),
    (error) => {
      assert.equal(error.code, 'HOTMAIL007_NO_STOCK');
      return true;
    }
  );
});

test('Hotmail007 purchase marks timeout with HOTMAIL007_TIMEOUT', async () => {
  const api = createHotmailStructuredApi({
    fetch: async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    },
  });

  await assert.rejects(
    () => api.requestHotmail007PurchasePayload({
      clientKey: 'client-key',
      mailType: 'OUTLOOK',
      quantity: 1,
      timeoutMs: 5000,
    }),
    (error) => {
      assert.equal(error.code, 'HOTMAIL007_TIMEOUT');
      return true;
    }
  );
});

test('Hotmail007 purchase marks insufficient balance with HOTMAIL007_BALANCE_LOW', async () => {
  const api = createHotmailStructuredApi({
    fetch: async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        msg: 'Insufficient balance',
      }),
    }),
  });

  await assert.rejects(
    () => api.requestHotmail007PurchasePayload({
      clientKey: 'client-key',
      mailType: 'OUTLOOK',
      quantity: 1,
    }),
    (error) => {
      assert.equal(error.code, 'HOTMAIL007_BALANCE_LOW');
      return true;
    }
  );
});

test('Hotmail local helper missing refresh token is marked with HOTMAIL_REFRESH_TOKEN_MISSING', async () => {
  const api = createHotmailStructuredApi();

  await assert.rejects(
    () => api.requestHotmailLocalMessages({
      email: 'user@hotmail.com',
      clientId: 'client-id',
      refreshToken: '',
    }),
    (error) => {
      assert.equal(error.code, 'HOTMAIL_REFRESH_TOKEN_MISSING');
      return true;
    }
  );
});

test('Hotmail local helper transport failure is marked with HOTMAIL_LOCAL_HELPER_UNAVAILABLE', async () => {
  const api = createHotmailStructuredApi({
    fetch: async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:17373');
    },
    getState: async () => ({}),
  });

  await assert.rejects(
    () => api.requestHotmailLocalMessages({
      email: 'user@hotmail.com',
      clientId: 'client-id',
      refreshToken: 'refresh-token',
    }),
    (error) => {
      assert.equal(error.code, 'HOTMAIL_LOCAL_HELPER_UNAVAILABLE');
      return true;
    }
  );
});
