const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/message-router.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

function createRouter(overrides = {}) {
  const events = {
    logs: [],
    stepStatuses: [],
    stateUpdates: [],
    broadcasts: [],
    balanceRefreshes: [],
    hotmail007BalanceRequests: [],
    hotmail007CatalogRequests: [],
    hotmail007BulkPurchases: [],
    emailStates: [],
    signupPhoneStates: [],
    signupPhoneSilentStates: [],
    finalizePayloads: [],
    phoneFinalizations: [],
    notifyCompletions: [],
    notifyErrors: [],
    securityBlocks: [],
    invalidations: [],
    executedSteps: [],
  };

  const router = api.createMessageRouter({
    addLog: async (message, level, options = {}) => {
      events.logs.push({ message, level, step: options.step, stepKey: options.stepKey });
    },
    appendAccountRunRecord: async () => null,
    batchUpdateLuckmailPurchases: async () => {},
    buildLocalhostCleanupPrefix: () => '',
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: () => ({}),
    broadcastDataUpdate: (updates) => {
      events.broadcasts.push(updates);
    },
    cancelScheduledAutoRun: async () => {},
    checkIcloudSession: async () => {},
    clearAutoRunTimerAlarm: async () => {},
    clearLuckmailRuntimeState: async () => {},
    clearStopRequest: () => {},
    closeLocalhostCallbackTabs: async () => {},
    closeTabsByUrlPrefix: async () => {},
    deleteHotmailAccount: async () => {},
    deleteHotmailAccounts: async () => {},
    deleteIcloudAlias: async () => {},
    deleteUsedIcloudAliases: async () => {},
    disableUsedLuckmailPurchases: async () => {},
    doesStepUseCompletionSignal: () => false,
    ensureManualInteractionAllowed: async () => ({}),
    executeStep: async (step) => {
      events.executedSteps.push(step);
    },
    executeStepViaCompletionSignal: async () => {},
    exportSettingsBundle: async () => ({}),
    fetchGeneratedEmail: async () => '',
    finalizePhoneActivationAfterSuccessfulFlow: overrides.finalizePhoneActivationAfterSuccessfulFlow || (async (state) => {
      events.phoneFinalizations.push(state);
    }),
    finalizeStep3Completion: overrides.finalizeStep3Completion || (async (payload) => {
      events.finalizePayloads.push(payload);
    }),
    finalizeIcloudAliasAfterSuccessfulFlow: overrides.finalizeIcloudAliasAfterSuccessfulFlow || (async () => {}),
    findHotmailAccount: async () => null,
    flushCommand: async () => {},
    getCurrentLuckmailPurchase: () => null,
    getPendingAutoRunTimerPlan: () => null,
    getSourceLabel: () => '',
    getState: async () => overrides.state || { stepStatuses: { 3: 'pending' } },
    getStepDefinitionForState: overrides.getStepDefinitionForState,
    getStepIdsForState: overrides.getStepIdsForState,
    getLastStepIdForState: overrides.getLastStepIdForState,
    getTabId: overrides.getTabId || (async () => null),
    getStopRequested: () => false,
    handleAutoRunLoopUnhandledError: async () => {},
    handleCloudflareSecurityBlocked: overrides.handleCloudflareSecurityBlocked || (async (error) => {
      const message = typeof error === 'string' ? error : error?.message || '';
      events.securityBlocks.push(message);
      return message.replace(/^CF_SECURITY_BLOCKED::/, '') || message;
    }),
    importSettingsBundle: async () => {},
    invalidateDownstreamAfterStepRestart: async (step, options) => {
      events.invalidations.push({ step, options });
    },
    isCloudflareSecurityBlockedError: overrides.isCloudflareSecurityBlockedError || ((error) => /^CF_SECURITY_BLOCKED::/.test(typeof error === 'string' ? error : error?.message || '')),
    isAutoRunLockedState: () => false,
    isHotmailProvider: () => false,
    isLocalhostOAuthCallbackUrl: () => true,
    isLuckmailProvider: () => false,
    isStopError: () => false,
    isTabAlive: overrides.isTabAlive || (async () => false),
    launchAutoRunTimerPlan: async () => {},
    listIcloudAliases: async () => [],
    listLuckmailPurchasesForManagement: async () => [],
    normalizeHotmailAccounts: (items) => items,
    normalizeRunCount: (value) => value,
    AUTO_RUN_TIMER_KIND_SCHEDULED_START: 'scheduled',
    notifyStepComplete: (step, payload) => {
      events.notifyCompletions.push({ step, payload });
    },
    notifyStepError: (step, error) => {
      events.notifyErrors.push({ step, error });
    },
    patchHotmailAccount: async () => {},
    registerTab: async () => {},
    requestStop: async () => {},
    resetState: async () => {},
    resumeAutoRun: async () => {},
    scheduleAutoRun: async () => {},
    selectLuckmailPurchase: async () => {},
    setCurrentHotmailAccount: async () => {},
    setEmailState: async (email) => {
      events.emailStates.push(email);
    },
    setEmailStateSilently: async () => {},
    setSignupPhoneState: async (phoneNumber) => {
      events.signupPhoneStates.push(phoneNumber);
    },
    setSignupPhoneStateSilently: async (phoneNumber) => {
      events.signupPhoneSilentStates.push(phoneNumber);
    },
    setIcloudAliasPreservedState: async () => {},
    setIcloudAliasUsedState: async () => {},
    setLuckmailPurchaseDisabledState: async () => {},
    setLuckmailPurchasePreservedState: async () => {},
    setLuckmailPurchaseUsedState: async () => {},
    setPersistentSettings: async () => {},
    setState: async (updates) => {
      events.stateUpdates.push(updates);
    },
    setStepStatus: async (step, status) => {
      events.stepStatuses.push({ step, status });
    },
    skipAutoRunCountdown: async () => false,
    skipStep: async () => {},
    startAutoRunLoop: async () => {},
    syncHotmailAccounts: async () => {},
    testHotmailAccountMailAccess: async () => {},
    upsertHotmailAccount: async () => {},
    verifyHotmailAccount: async () => {},
    refreshGpcCardBalance: overrides.refreshGpcCardBalance || (async (state, options) => {
      events.balanceRefreshes.push({ state, options });
      return { balance: '余额 3' };
    }),
    fetchHotmail007Balance: overrides.fetchHotmail007Balance || (async (options) => {
      events.hotmail007BalanceRequests.push(options);
      return { balance: 1.25, balanceText: 'Hotmail007 余额：1.25' };
    }),
    fetchHotmail007MailPriceList: overrides.fetchHotmail007MailPriceList || (async (options) => {
      events.hotmail007CatalogRequests.push(options);
      return {
        entries: [{ type: 'hotmail-premium', price: 0.003, live: '1-3 Hours', stock: 958, access: '0', id: '9' }],
      };
    }),
    purchaseHotmailAccountsFromHotmail007: overrides.purchaseHotmailAccountsFromHotmail007 || (async (options) => {
      events.hotmail007BulkPurchases.push(options);
      return {
        accounts: [{ id: 'acc-1', email: 'demo@hotmail.com' }],
        account: { id: 'acc-1', email: 'demo@hotmail.com' },
      };
    }),
  });

  return { router, events };
}

test('message router skips step 3 when step 2 lands on verification page', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 3: 'pending' } },
  });

  await router.handleStepData(2, {
    email: 'user@example.com',
    skippedPasswordStep: true,
  });

  assert.deepStrictEqual(events.emailStates, ['user@example.com']);
  assert.deepStrictEqual(events.stepStatuses, [{ step: 3, status: 'skipped' }]);
  assert.equal(events.logs[0]?.message, '步骤 2：提交邮箱后页面直接进入验证码页，已自动跳过步骤 3。');
});

test('message router syncs signup phone runtime state from step 2 payload immediately', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 3: 'pending' } },
  });

  await router.handleStepData(2, {
    accountIdentifierType: 'phone',
    accountIdentifier: '66959916439',
    signupPhoneNumber: '66959916439',
  });

  assert.deepStrictEqual(events.emailStates, []);
  assert.deepStrictEqual(events.signupPhoneSilentStates, ['66959916439']);
  assert.deepStrictEqual(events.signupPhoneStates, []);
});

test('message router clears stale signup phone runtime when step 2 resolves email identity', async () => {
  const { router, events } = createRouter({
    state: {
      stepStatuses: { 3: 'pending' },
      accountIdentifierType: 'phone',
      accountIdentifier: '+66959916439',
      signupPhoneNumber: '+66959916439',
      signupPhoneActivation: { activationId: 'old', phoneNumber: '+66959916439' },
    },
  });

  await router.handleStepData(2, {
    email: 'user@example.com',
    accountIdentifierType: 'email',
    accountIdentifier: 'user@example.com',
  });

  assert.deepStrictEqual(events.emailStates, ['user@example.com']);
  assert.deepStrictEqual(events.signupPhoneSilentStates, [null]);
  assert.ok(events.stateUpdates.some((updates) => (
    updates.accountIdentifierType === 'email'
    && updates.accountIdentifier === 'user@example.com'
    && updates.signupPhoneNumber === ''
    && updates.signupPhoneActivation === null
    && updates.signupPhoneCompletedActivation === null
  )));
});

test('message router does not overwrite a completed step 3 when step 2 is replayed', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 3: 'completed' } },
  });

  await router.handleStepData(2, {
    skippedPasswordStep: true,
  });

  assert.deepStrictEqual(events.stepStatuses, []);
});

test('message router skips steps 3/4/5 when step 2 detects already logged-in session', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 3: 'pending', 4: 'completed', 5: 'pending' } },
  });

  await router.handleStepData(2, {
    email: 'user@example.com',
    skipRegistrationFlow: true,
    skippedPasswordStep: true,
  });

  assert.deepStrictEqual(events.emailStates, ['user@example.com']);
  assert.deepStrictEqual(events.stepStatuses, [
    { step: 3, status: 'skipped' },
    { step: 5, status: 'skipped' },
  ]);
  assert.equal(events.logs[0]?.message, '步骤 2：检测到当前已登录会话，已自动跳过步骤 3/4/5，流程将直接进入步骤 6。');
});

test('message router skips step 5 when step 4 reports already logged-in transition', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 5: 'pending' } },
  });

  await router.handleStepData(4, {
    emailTimestamp: 123,
    skipProfileStep: true,
  });

  assert.deepStrictEqual(events.stepStatuses, [{ step: 5, status: 'skipped' }]);
  assert.equal(events.logs[0]?.message, '步骤 4：检测到账号已直接进入已登录态，已自动跳过步骤 5。');
});

test('message router skips login-code step when oauth login lands on consent page', async () => {
  const stepKeys = {
    7: 'oauth-login',
    8: 'fetch-login-code',
    9: 'confirm-oauth',
  };
  const { router, events } = createRouter({
    state: { stepStatuses: { 7: 'completed', 8: 'pending', 9: 'pending' } },
    getStepDefinitionForState: (step) => ({ id: step, key: stepKeys[step] || '' }),
    getStepIdsForState: () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  });

  await router.handleStepData(7, {
    skipLoginVerificationStep: true,
    directOAuthConsentPage: true,
  });

  assert.deepStrictEqual(events.stepStatuses, [{ step: 8, status: 'skipped' }]);
  assert.equal(events.logs.some(({ message }) => /OAuth 授权页.*步骤 8/.test(message)), true);
});

test('message router skips Plus login-code step when oauth login lands on consent page', async () => {
  const stepKeys = {
    10: 'oauth-login',
    11: 'fetch-login-code',
    12: 'confirm-oauth',
    13: 'platform-verify',
  };
  const { router, events } = createRouter({
    state: { plusModeEnabled: true, stepStatuses: { 10: 'completed', 11: 'pending', 12: 'pending', 13: 'pending' } },
    getStepDefinitionForState: (step) => ({ id: step, key: stepKeys[step] || '' }),
    getStepIdsForState: () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  });

  await router.handleStepData(10, {
    skipLoginVerificationStep: true,
    directOAuthConsentPage: true,
  });

  assert.deepStrictEqual(events.stepStatuses, [{ step: 11, status: 'skipped' }]);
  assert.equal(events.logs.some(({ message }) => /OAuth 授权页.*步骤 11/.test(message)), true);
});

test('message router finalizes step 3 before marking it completed', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'STEP_COMPLETE',
    step: 3,
    source: 'signup-page',
    payload: {
      email: 'user@example.com',
      signupVerificationRequestedAt: 123,
    },
  }, {});

  assert.deepStrictEqual(events.finalizePayloads, [
    {
      email: 'user@example.com',
      signupVerificationRequestedAt: 123,
    },
  ]);
  assert.deepStrictEqual(events.stepStatuses, [{ step: 3, status: 'completed' }]);
  assert.deepStrictEqual(events.emailStates, ['user@example.com']);
  assert.deepStrictEqual(events.notifyCompletions, [
    {
      step: 3,
      payload: {
        email: 'user@example.com',
        signupVerificationRequestedAt: 123,
      },
    },
  ]);
assert.deepStrictEqual(response, { ok: true });
});

test('message router saves runtime signup phone from sidepanel message', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'SAVE_SIGNUP_PHONE',
    source: 'sidepanel',
    payload: {
      phoneNumber: '66959916439',
    },
  }, {});

  assert.deepStrictEqual(events.signupPhoneStates, ['66959916439']);
  assert.deepStrictEqual(events.signupPhoneSilentStates, []);
  assert.deepStrictEqual(response, { ok: true, phoneNumber: '66959916439' });
});

test('message router finalizes pending phone activation on platform verify success', async () => {
  const state = {
    stepStatuses: { 10: 'pending' },
    reusablePhoneActivation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      successfulUses: 0,
      maxUses: 3,
    },
    pendingPhoneActivationConfirmation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      successfulUses: 0,
      maxUses: 3,
    },
  };
  const { router, events } = createRouter({
    state,
    getStepDefinitionForState: (step) => ({ id: step, key: step === 10 ? 'platform-verify' : '' }),
  });

  await router.handleStepData(10, {
    localhostUrl: 'http://localhost:1455/auth/callback?code=ok',
  });

  assert.deepStrictEqual(events.phoneFinalizations, [state]);
});

test('message router does not finalize pending phone activation when icloud finalization fails', async () => {
  const state = {
    stepStatuses: { 10: 'pending' },
    reusablePhoneActivation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      successfulUses: 0,
      maxUses: 3,
    },
    pendingPhoneActivationConfirmation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      successfulUses: 0,
      maxUses: 3,
    },
  };
  const { router, events } = createRouter({
    state,
    getStepDefinitionForState: (step) => ({ id: step, key: step === 10 ? 'platform-verify' : '' }),
    finalizeIcloudAliasAfterSuccessfulFlow: async () => {
      throw new Error('icloud finalize failed');
    },
  });

  await assert.rejects(
    () => router.handleStepData(10, {
      localhostUrl: 'http://localhost:1455/auth/callback?code=ok',
    }),
    /icloud finalize failed/
  );

  assert.deepStrictEqual(events.phoneFinalizations, []);
});

test('message router marks step 3 failed when post-submit finalize fails', async () => {
  const { router, events } = createRouter({
    finalizeStep3Completion: async () => {
      throw new Error('步骤 3 提交后仍停留在密码页。');
    },
  });

  const response = await router.handleMessage({
    type: 'STEP_COMPLETE',
    step: 3,
    source: 'signup-page',
    payload: {
      email: 'user@example.com',
    },
  }, {});

  assert.deepStrictEqual(events.stepStatuses, [{ step: 3, status: 'failed' }]);
  assert.deepStrictEqual(events.notifyErrors, [
    {
      step: 3,
      error: '步骤 3 提交后仍停留在密码页。',
    },
  ]);
  assert.equal(events.logs.some(({ message, step }) => /失败：步骤 3 提交后仍停留在密码页。/.test(message) && step === 3), true);
  assert.deepStrictEqual(response, { ok: true, error: '步骤 3 提交后仍停留在密码页。' });
});

test('message router stops the flow and surfaces cloudflare security block errors', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'STEP_ERROR',
    step: 7,
    source: 'signup-page',
    payload: {},
    error: 'CF_SECURITY_BLOCKED::您已触发Cloudflare 安全防护系统',
  }, {});

  assert.deepStrictEqual(events.securityBlocks, ['CF_SECURITY_BLOCKED::您已触发Cloudflare 安全防护系统']);
  assert.deepStrictEqual(events.notifyErrors, [
    {
      step: 7,
      error: '流程已被用户停止。',
    },
  ]);
  assert.deepStrictEqual(response, {
    ok: true,
    error: '您已触发Cloudflare 安全防护系统',
  });
});

test('message router blocks manual step 4 execution when signup page tab is missing', async () => {
  const { router, events } = createRouter({
    getTabId: async () => null,
    isTabAlive: async () => false,
  });

  await assert.rejects(
    () => router.handleMessage({
      type: 'EXECUTE_STEP',
      source: 'sidepanel',
      payload: { step: 4 },
    }, {}),
    /手动执行步骤 4 前，请先执行步骤 1 或步骤 2/
  );

  assert.deepStrictEqual(events.invalidations, []);
  assert.deepStrictEqual(events.executedSteps, []);
});

test('message router resolves GPC OTP manual confirmation without completing step early', async () => {
  const state = {
    plusManualConfirmationPending: true,
    plusManualConfirmationRequestId: 'otp-request-1',
    plusManualConfirmationStep: 7,
    plusManualConfirmationMethod: 'gopay-otp',
  };
  const { router, events } = createRouter({ state });

  const response = await router.handleMessage({
    type: 'RESOLVE_PLUS_MANUAL_CONFIRMATION',
    source: 'sidepanel',
    payload: {
      step: 7,
      requestId: 'otp-request-1',
      confirmed: true,
      otp: ' 12-34 56 ',
    },
  }, {});

  assert.deepStrictEqual(response, { ok: true });
  assert.equal(events.notifyCompletions.length, 0);
  assert.equal(events.stepStatuses.length, 0);
  assert.equal(events.stateUpdates[0].gopayHelperResolvedOtp, '123456');
  assert.equal(events.stateUpdates[0].plusManualConfirmationPending, false);
  assert.deepStrictEqual(events.broadcasts[0], events.stateUpdates[0]);
});

test('message router refreshes GPC balance through explicit sidepanel message', async () => {
  const state = {
    plusPaymentMethod: 'gpc-helper',
    gopayHelperApiUrl: 'http://localhost:18473/',
    gopayHelperCardKey: 'state_card',
  };
  const { router, events } = createRouter({ state });

  const response = await router.handleMessage({
    type: 'REFRESH_GPC_CARD_BALANCE',
    source: 'sidepanel',
    payload: {
      gopayHelperCardKey: 'payload_card',
      reason: 'manual',
    },
  }, {});

  assert.deepStrictEqual(response, { ok: true, balance: '余额 3' });
  assert.equal(events.balanceRefreshes.length, 1);
  assert.equal(events.balanceRefreshes[0].state.gopayHelperApiUrl, 'http://localhost:18473/');
  assert.equal(events.balanceRefreshes[0].state.gopayHelperCardKey, 'payload_card');
  assert.deepStrictEqual(events.balanceRefreshes[0].options, { reason: 'manual' });
});

test('message router fetches hotmail007 balance through explicit sidepanel message', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'FETCH_HOTMAIL007_BALANCE',
    source: 'sidepanel',
    payload: {
      clientKey: 'client-key-1',
    },
  }, {});

  assert.deepStrictEqual(response, { ok: true, balance: 1.25, balanceText: 'Hotmail007 余额：1.25' });
  assert.deepStrictEqual(events.hotmail007BalanceRequests, [{ clientKey: 'client-key-1' }]);
});

test('message router fetches hotmail007 dynamic catalog through explicit sidepanel message', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'FETCH_HOTMAIL007_MAIL_PRICE_LIST',
    source: 'sidepanel',
    payload: {
      reason: 'manual',
    },
  }, {});

  assert.deepStrictEqual(response, {
    ok: true,
    entries: [{ type: 'hotmail-premium', price: 0.003, live: '1-3 Hours', stock: 958, access: '0', id: '9' }],
  });
  assert.deepStrictEqual(events.hotmail007CatalogRequests, [{ reason: 'manual' }]);
});

test('message router forwards manual hotmail007 purchase quantity to bulk purchase helper', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'PREFETCH_HOTMAIL007_ACCOUNT',
    source: 'sidepanel',
    payload: {
      clientKey: 'client-key-1',
      mailType: 'hotmail-premium',
      quantity: 5,
    },
  }, {});

  assert.deepStrictEqual(response, {
    ok: true,
    accounts: [{ id: 'acc-1', email: 'demo@hotmail.com' }],
    account: { id: 'acc-1', email: 'demo@hotmail.com' },
  });
  assert.deepStrictEqual(events.hotmail007BulkPurchases, [{
    clientKey: 'client-key-1',
    mailType: 'hotmail-premium',
    quantity: 5,
  }]);
});
