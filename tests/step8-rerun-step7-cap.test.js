const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const step8Source = fs.readFileSync('background/steps/fetch-login-code.js', 'utf8');
const step8GlobalScope = {};
const step8Api = new Function('self', `${step8Source}; return self.MultiPageBackgroundStep8;`)(step8GlobalScope);

test('step 8 escalates repeated direct rerun-step7 recoveries into RESTART_CURRENT_ATTEMPT', async () => {
  const calls = {
    rerunStep7: 0,
    ensureReady: 0,
  };

  const executor = step8Api.createStep8Executor({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    confirmCustomVerificationStepBypass: async () => {},
    ensureStep8VerificationPageReady: async () => {
      calls.ensureReady += 1;
      throw new Error('STEP8_RESTART_STEP7::step 8 timeout retry page');
    },
    rerunStep7ForStep8Recovery: async () => {
      calls.rerunStep7 += 1;
      if (calls.rerunStep7 > 3) {
        throw new Error('TOO_MANY_RERUNS');
      }
    },
    getOAuthFlowRemainingMs: async () => 8000,
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => Math.min(defaultTimeoutMs, 8000),
    getMailConfig: () => ({
      provider: 'qq',
      label: 'QQ mail',
      source: 'mail-qq',
      url: 'https://mail.qq.com',
      navigateOnReuse: false,
    }),
    getState: async () => ({ email: 'user@example.com', password: 'secret', oauthUrl: 'https://oauth.example/latest' }),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => true,
    isVerificationMailPollingError: () => false,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    resolveVerificationStep: async () => {},
    reuseOrCreateTab: async () => {},
    setState: async () => {},
    setStepStatus: async () => {},
    shouldUseCustomRegistrationEmail: () => false,
    sleepWithStop: async () => {},
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS: 20,
    throwIfStopped: () => {},
  });

  const error = await executor.executeStep8({
    email: 'user@example.com',
    password: 'secret',
    oauthUrl: 'https://oauth.example/latest',
  }).then(() => null, (err) => err);

  assert.equal(error?.code, 'RESTART_CURRENT_ATTEMPT');
  assert.equal(error?.restartReasonCode, 'step8_rerun_step7_limit_exceeded');
  assert.match(String(error?.message || ''), /RESTART_CURRENT_ATTEMPT::STEP8_RERUN_STEP7_LIMIT_EXCEEDED::/);
  assert.equal(calls.rerunStep7, 2);
  assert.equal(calls.ensureReady, 3);
});

test('step 8 escalates repeated polling-driven rerun-step7 recoveries into RESTART_CURRENT_ATTEMPT', async () => {
  const calls = {
    rerunStep7: 0,
    ensureReady: 0,
  };

  const executor = step8Api.createStep8Executor({
    addLog: async () => {},
    chrome: { tabs: { update: async () => {} } },
    CLOUDFLARE_TEMP_EMAIL_PROVIDER: 'cloudflare-temp-email',
    completeStepFromBackground: async () => {},
    confirmCustomVerificationStepBypass: async () => {},
    ensureStep8VerificationPageReady: async () => {
      calls.ensureReady += 1;
      return { state: 'verification_page' };
    },
    rerunStep7ForStep8Recovery: async () => {
      calls.rerunStep7 += 1;
      if (calls.rerunStep7 > 3) {
        throw new Error('TOO_MANY_RERUNS');
      }
    },
    getOAuthFlowRemainingMs: async () => 8000,
    getOAuthFlowStepTimeoutMs: async (defaultTimeoutMs) => Math.min(defaultTimeoutMs, 8000),
    getMailConfig: () => ({
      provider: 'qq',
      label: 'QQ mail',
      source: 'mail-qq',
      url: 'https://mail.qq.com',
      navigateOnReuse: false,
    }),
    getState: async () => ({ email: 'user@example.com', password: 'secret', oauthUrl: 'https://oauth.example/latest' }),
    getTabId: async () => 1,
    HOTMAIL_PROVIDER: 'hotmail-api',
    isTabAlive: async () => true,
    isVerificationMailPollingError: () => true,
    LUCKMAIL_PROVIDER: 'luckmail-api',
    resolveVerificationStep: async () => {
      throw new Error('Content script on icloud-mail did not respond in 1s. Try refreshing the tab and retry.');
    },
    reuseOrCreateTab: async () => {},
    setState: async () => {},
    setStepStatus: async () => {},
    shouldUseCustomRegistrationEmail: () => false,
    sleepWithStop: async () => {},
    STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS: 25000,
    STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS: 20,
    throwIfStopped: () => {},
  });

  const error = await executor.executeStep8({
    email: 'user@example.com',
    password: 'secret',
    oauthUrl: 'https://oauth.example/latest',
  }).then(() => null, (err) => err);

  assert.equal(error?.code, 'RESTART_CURRENT_ATTEMPT');
  assert.equal(error?.restartReasonCode, 'step8_rerun_step7_limit_exceeded');
  assert.match(String(error?.message || ''), /RESTART_CURRENT_ATTEMPT::STEP8_RERUN_STEP7_LIMIT_EXCEEDED::/);
  assert.equal(calls.rerunStep7, 2);
  assert.equal(calls.ensureReady >= 12, true);
});
