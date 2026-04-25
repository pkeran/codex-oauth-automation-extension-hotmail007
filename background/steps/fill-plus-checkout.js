(function attachBackgroundPlusCheckoutBilling(root, factory) {
  root.MultiPageBackgroundPlusCheckoutBilling = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPlusCheckoutBillingModule() {
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PLUS_CHECKOUT_INJECT_FILES = ['content/utils.js', 'content/plus-checkout.js'];

  function createPlusCheckoutBillingExecutor(deps = {}) {
    const {
      addLog,
      completeStepFromBackground,
      ensureContentScriptReadyOnTabUntilStopped,
      generateRandomName,
      getAddressSeedForCountry,
      getTabId,
      isTabAlive,
      sendTabMessageUntilStopped,
      setState,
      sleepWithStop,
      waitForTabCompleteUntilStopped,
      waitForTabUrlMatchUntilStopped,
    } = deps;

    async function getCheckoutTabId(state = {}) {
      const registeredTabId = await getTabId(PLUS_CHECKOUT_SOURCE);
      if (registeredTabId && await isTabAlive(PLUS_CHECKOUT_SOURCE)) {
        return registeredTabId;
      }
      const storedTabId = Number(state.plusCheckoutTabId) || 0;
      if (storedTabId) {
        return storedTabId;
      }
      throw new Error('步骤 7：未找到 Plus Checkout 标签页，请先完成步骤 6。');
    }

    async function executePlusCheckoutBilling(state = {}) {
      const tabId = await getCheckoutTabId(state);
      await addLog('步骤 7：正在等待 Plus Checkout 页面加载完成...', 'info');
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);

      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: '步骤 7：Checkout 页面仍在加载，等待账单填写脚本就绪...',
      });

      const randomName = generateRandomName();
      const fullName = [randomName.firstName, randomName.lastName].filter(Boolean).join(' ');
      const addressSeed = getAddressSeedForCountry(state.plusCheckoutCountry || 'DE', {
        fallbackCountry: 'DE',
      });
      if (!addressSeed) {
        throw new Error('步骤 7：未找到可用的本地账单地址种子。');
      }

      await addLog(`步骤 7：正在选择 PayPal 并填写账单地址（${addressSeed.countryCode} / ${addressSeed.query}）...`, 'info');
      const result = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
        type: 'FILL_PLUS_BILLING_AND_SUBMIT',
        source: 'background',
        payload: {
          fullName,
          addressSeed,
        },
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      await setState({
        plusCheckoutTabId: tabId,
        plusBillingCountryText: result?.countryText || '',
        plusBillingAddress: result?.structuredAddress || null,
      });

      await addLog('步骤 7：账单地址已提交，正在等待跳转到 PayPal...', 'info');
      await waitForTabUrlMatchUntilStopped(tabId, (url) => /paypal\./i.test(url));
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);

      await completeStepFromBackground(7, {
        plusBillingCountryText: result?.countryText || '',
      });
    }

    return {
      executePlusCheckoutBilling,
    };
  }

  return {
    createPlusCheckoutBillingExecutor,
  };
});
