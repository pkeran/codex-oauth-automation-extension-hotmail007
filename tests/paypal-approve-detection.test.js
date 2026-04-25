const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/steps/paypal-approve.js', 'utf8');

function loadModule() {
  const self = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundPayPalApprove;`)(self);
}

function createExecutor({ pageStates, submitResults, tabUrls = [] }) {
  const api = loadModule();
  const events = {
    completed: [],
    logs: [],
    messages: [],
    submittedPayloads: [],
  };
  const stateQueue = [...pageStates];
  const submitQueue = [...submitResults];
  const urlQueue = [...tabUrls];
  let lastUrl = urlQueue.shift() || 'https://www.paypal.com/signin';

  const executor = api.createPayPalApproveExecutor({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    chrome: {
      tabs: {
        get: async () => {
          if (urlQueue.length) {
            lastUrl = urlQueue.shift();
          }
          return {
            id: 1,
            status: 'complete',
            url: lastUrl,
          };
        },
      },
    },
    completeStepFromBackground: async (step, payload) => {
      events.completed.push({ step, payload });
    },
    ensureContentScriptReadyOnTabUntilStopped: async () => {},
    getTabId: async (source) => (source === 'paypal-flow' ? 1 : null),
    isTabAlive: async () => true,
    sendTabMessageUntilStopped: async (_tabId, _source, message) => {
      events.messages.push(message.type);
      if (message.type === 'PAYPAL_GET_STATE') {
        return stateQueue.shift() || pageStates[pageStates.length - 1] || {};
      }
      if (message.type === 'PAYPAL_SUBMIT_LOGIN') {
        events.submittedPayloads.push(message.payload);
        return submitQueue.shift() || { submitted: true, phase: 'password_submitted' };
      }
      if (message.type === 'PAYPAL_DISMISS_PROMPTS') {
        return { clicked: 0 };
      }
      if (message.type === 'PAYPAL_CLICK_APPROVE') {
        return { clicked: true };
      }
      return {};
    },
    setState: async () => {},
    sleepWithStop: async () => {},
    waitForTabCompleteUntilStopped: async () => {},
    waitForTabUrlMatchUntilStopped: async () => {},
  });

  return { executor, events };
}

test('PayPal approve keeps original combined email and password login path', async () => {
  const { executor, events } = createExecutor({
    pageStates: [
      { needsLogin: true, hasEmailInput: true, hasPasswordInput: true, loginPhase: 'login_combined' },
      { needsLogin: false, approveReady: true },
      { needsLogin: false, approveReady: true },
    ],
    submitResults: [
      { submitted: true, phase: 'password_submitted', awaiting: 'redirect_or_approval' },
    ],
  });

  await executor.executePayPalApprove({
    paypalEmail: 'user@example.com',
    paypalPassword: 'secret',
  });

  assert.equal(events.submittedPayloads.length, 1);
  assert.deepEqual(events.completed.map((item) => item.step), [8]);
  assert.equal(events.messages.includes('PAYPAL_CLICK_APPROVE'), true);
});

test('PayPal approve auto-detects split email then password pages', async () => {
  const { executor, events } = createExecutor({
    pageStates: [
      { needsLogin: true, hasEmailInput: true, hasPasswordInput: false, loginPhase: 'email' },
      { needsLogin: true, hasEmailInput: false, hasPasswordInput: true, loginPhase: 'password' },
      { needsLogin: true, hasEmailInput: false, hasPasswordInput: true, loginPhase: 'password' },
      { needsLogin: false, approveReady: true },
      { needsLogin: false, approveReady: true },
    ],
    submitResults: [
      { submitted: false, phase: 'email_submitted', awaiting: 'password_page' },
      { submitted: true, phase: 'password_submitted', awaiting: 'redirect_or_approval' },
    ],
  });

  await executor.executePayPalApprove({
    paypalEmail: 'user@example.com',
    paypalPassword: 'secret',
  });

  assert.equal(events.submittedPayloads.length, 2);
  assert.deepEqual(events.completed.map((item) => item.step), [8]);
  assert.equal(events.logs.some(({ message }) => /识别到密码页/.test(message)), true);
  assert.equal(events.messages.includes('PAYPAL_CLICK_APPROVE'), true);
});

test('PayPal approve finishes when login redirects away from PayPal', async () => {
  const { executor, events } = createExecutor({
    pageStates: [
      { needsLogin: true, hasEmailInput: false, hasPasswordInput: true, loginPhase: 'password' },
    ],
    submitResults: [
      { submitted: true, phase: 'password_submitted', awaiting: 'redirect_or_approval' },
    ],
    tabUrls: [
      'https://www.paypal.com/signin',
      'https://www.paypal.com/signin',
      'https://checkout.openai.com/return',
    ],
  });

  await executor.executePayPalApprove({
    paypalEmail: 'user@example.com',
    paypalPassword: 'secret',
  });

  assert.equal(events.submittedPayloads.length, 1);
  assert.deepEqual(events.completed.map((item) => item.step), [8]);
  assert.equal(events.messages.includes('PAYPAL_CLICK_APPROVE'), false);
});
