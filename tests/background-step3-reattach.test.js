const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('tab runtime reattaches content script after retryable transport error and then succeeds', async () => {
  const source = fs.readFileSync('background/tab-runtime.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundTabRuntime;`)(globalScope);

  let pingReady = false;
  let sendCalls = 0;
  let sourceInjectCalls = 0;
  let fileInjectCalls = 0;
  let state = {
    tabRegistry: {
      'signup-page': {
        tabId: 31,
        ready: true,
      },
    },
    sourceLastUrls: {},
  };

  const runtime = api.createTabRuntime({
    LOG_PREFIX: '[test]',
    STOP_ERROR_MESSAGE: 'Flow stopped.',
    addLog: async () => {},
    chrome: {
      tabs: {
        get: async () => ({
          id: 31,
          url: 'https://chatgpt.com/',
          status: 'complete',
        }),
        query: async () => [],
        sendMessage: async (_tabId, message) => {
          if (message?.type === 'PING') {
            return pingReady ? { ok: true, source: 'signup-page' } : null;
          }
          sendCalls += 1;
          if (sendCalls === 1) {
            throw new Error('Could not establish connection. Receiving end does not exist.');
          }
          return { ready: true, recovered: true };
        },
      },
      scripting: {
        executeScript: async ({ files, func }) => {
          if (typeof func === 'function') {
            sourceInjectCalls += 1;
          }
          if (Array.isArray(files) && files.length) {
            fileInjectCalls += 1;
            pingReady = true;
          }
          return [];
        },
      },
    },
    getSourceLabel: (value) => value || 'unknown',
    getState: async () => state,
    isLocalhostOAuthCallbackUrl: () => false,
    isRetryableContentScriptTransportError: (error) => /Receiving end does not exist/i.test(error?.message || String(error || '')),
    matchesSourceUrlFamily: () => false,
    setState: async (updates) => {
      state = {
        ...state,
        ...(updates || {}),
      };
    },
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });

  const result = await runtime.sendToContentScriptResilient('signup-page', {
    type: 'PREPARE_SIGNUP_VERIFICATION',
    step: 3,
    source: 'background',
    payload: {},
  }, {
    timeoutMs: 1500,
    retryDelayMs: 1,
    logMessage: 'step3 reattach',
    onRetryableTransportError: async () => {
      await runtime.ensureContentScriptReadyOnTab('signup-page', 31, {
        inject: ['content/signup-page.js'],
        injectSource: 'signup-page',
        timeoutMs: 1500,
        retryDelayMs: 1,
      });
    },
  });

  assert.deepStrictEqual(result, { ready: true, recovered: true });
  assert.equal(sendCalls, 2);
  assert.equal(sourceInjectCalls >= 1, true);
  assert.equal(fileInjectCalls >= 1, true);
  assert.equal(state.tabRegistry['signup-page']?.ready, true);
});

test('signup flow helper passes a reattach callback for step 3 finalize and can recover', async () => {
  const source = fs.readFileSync('background/signup-flow-helpers.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageSignupFlowHelpers;`)(globalScope);

  let ensureCalls = 0;
  let callbackCalls = 0;
  const helper = api.createSignupFlowHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => '',
    chrome: {
      tabs: {
        get: async () => ({ id: 31, url: 'https://chatgpt.com/' }),
      },
    },
    ensureContentScriptReadyOnTab: async () => {
      ensureCalls += 1;
    },
    ensureHotmailAccountForFlow: async () => ({}),
    ensureLuckmailPurchaseForFlow: async () => ({}),
    isGeneratedAliasProvider: () => false,
    isReusableGeneratedAliasEmail: () => false,
    isHotmailProvider: () => false,
    isRetryableContentScriptTransportError: (error) => /Receiving end does not exist/i.test(error?.message || String(error || '')),
    isLuckmailProvider: () => false,
    isSignupEmailVerificationPageUrl: () => false,
    isSignupPasswordPageUrl: () => true,
    reuseOrCreateTab: async () => 31,
    sendToContentScriptResilient: async (_source, message, options) => {
      assert.equal(message.type, 'PREPARE_SIGNUP_VERIFICATION');
      assert.equal(typeof options?.onRetryableTransportError, 'function');
      callbackCalls += 1;
      await options.onRetryableTransportError(new Error('Could not establish connection. Receiving end does not exist.'));
      return { ready: true, retried: 1 };
    },
    setEmailState: async () => {},
    SIGNUP_ENTRY_URL: 'https://chatgpt.com/',
    SIGNUP_PAGE_INJECT_FILES: ['content/utils.js', 'content/signup-page.js'],
    waitForTabUrlMatch: async () => null,
  });

  const result = await helper.finalizeSignupPasswordSubmitInTab(31, 'Secret123!', 3);

  assert.deepStrictEqual(result, { ready: true, retried: 1 });
  assert.equal(callbackCalls, 1);
  assert.equal(ensureCalls, 2);
});
