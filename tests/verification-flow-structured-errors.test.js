const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/verification-flow.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundVerificationFlow;`)(globalScope);

function createHelpers(overrides = {}) {
  return api.createVerificationFlowHelpers({
    addLog: async () => {},
    chrome: {
      tabs: {
        update: async () => {},
        get: async () => ({ url: 'https://auth.openai.com/u/login/identifier' }),
      },
    },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypassRequest: async () => ({ confirmed: true }),
    getHotmailVerificationPollConfig: () => ({}),
    getHotmailVerificationRequestTimestamp: () => 0,
    getState: async () => ({}),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isStopError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    MAIL_2925_VERIFICATION_INTERVAL_MS: 15000,
    MAIL_2925_VERIFICATION_MAX_ATTEMPTS: 15,
    pollCloudflareTempEmailVerificationCode: async () => ({}),
    pollHotmailVerificationCode: async () => ({}),
    pollLuckmailVerificationCode: async () => ({}),
    sendToContentScript: async () => ({}),
    sendToContentScriptResilient: async () => ({}),
    sendToMailContentScriptResilient: async () => ({}),
    setState: async () => {},
    setStepStatus: async () => {},
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    VERIFICATION_POLL_MAX_ROUNDS: 5,
    ...overrides,
  });
}

test('verification flow marks missing mail code as MAIL_CODE_TIMEOUT', async () => {
  const helpers = createHelpers({
    sendToMailContentScriptResilient: async () => ({}),
  });

  await assert.rejects(
    () => helpers.pollFreshVerificationCode(
      8,
      { email: 'user@example.com', lastLoginCode: null },
      { provider: 'qq', label: 'QQ Mail' },
      {
        maxAttempts: 1,
        intervalMs: 1,
        maxResendRequests: 0,
      }
    ),
    (error) => {
      assert.equal(error.code, 'MAIL_CODE_TIMEOUT');
      return true;
    }
  );
});

test('verification flow marks duplicate mail code as MAIL_CODE_DUPLICATE', async () => {
  const helpers = createHelpers({
    sendToMailContentScriptResilient: async () => ({
      code: '654321',
      emailTimestamp: 123,
    }),
  });

  await assert.rejects(
    () => helpers.pollFreshVerificationCode(
      8,
      { email: 'user@example.com', lastLoginCode: '654321' },
      { provider: 'qq', label: 'QQ Mail' },
      {
        maxAttempts: 1,
        intervalMs: 1,
        maxResendRequests: 0,
      }
    ),
    (error) => {
      assert.equal(error.code, 'MAIL_CODE_DUPLICATE');
      return true;
    }
  );
});

test('verification flow marks temporary mailbox provider failure as MAIL_PROVIDER_TRANSIENT', async () => {
  const helpers = createHelpers({
    sendToMailContentScriptResilient: async () => ({
      error: 'temporary unavailable, please retry later',
    }),
  });

  await assert.rejects(
    () => helpers.pollFreshVerificationCode(
      4,
      { email: 'user@example.com', lastSignupCode: null },
      { provider: 'qq', label: 'QQ Mail' },
      {
        maxAttempts: 1,
        intervalMs: 1,
        maxResendRequests: 0,
      }
    ),
    (error) => {
      assert.equal(error.code, 'MAIL_PROVIDER_TRANSIENT');
      return true;
    }
  );
});

test('verification flow marks mailbox auth failure as MAIL_PROVIDER_AUTH_INVALID', async () => {
  const helpers = createHelpers({
    sendToMailContentScriptResilient: async () => ({
      error: 'refresh token invalid for mailbox provider',
    }),
  });

  await assert.rejects(
    () => helpers.pollFreshVerificationCode(
      4,
      { email: 'user@example.com', lastSignupCode: null },
      { provider: 'qq', label: 'QQ Mail' },
      {
        maxAttempts: 1,
        intervalMs: 1,
        maxResendRequests: 0,
      }
    ),
    (error) => {
      assert.equal(error.code, 'MAIL_PROVIDER_AUTH_INVALID');
      return true;
    }
  );
});

test('verification flow marks step8 timeout-page fallback as STEP8_RESTART_STEP7_REQUIRED', async () => {
  const helpers = createHelpers({
    sendToMailContentScriptResilient: async () => ({
      code: '654321',
      emailTimestamp: 123,
    }),
    sendToContentScriptResilient: async (_source, message) => {
      if (message.type === 'FILL_CODE') {
        throw new Error('message channel is closed before a response was received');
      }
      if (message.type === 'GET_LOGIN_AUTH_STATE') {
        return {
          state: 'login_timeout_error_page',
          url: 'https://auth.openai.com/u/login/identifier?state=timeout',
        };
      }
      return {};
    },
  });

  await assert.rejects(
    () => helpers.resolveVerificationStep(
      8,
      { email: 'user@example.com', lastLoginCode: null },
      { provider: 'qq', label: 'QQ Mail' },
      {}
    ),
    (error) => {
      assert.equal(error.code, 'STEP8_RESTART_STEP7_REQUIRED');
      return true;
    }
  );
});
