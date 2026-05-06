(function attachSidepanelAccountCostLedgerManager(globalScope) {
  function createAccountCostLedgerManager(context = {}) {
    const {
      state,
      dom,
      helpers,
      runtime,
      constants = {},
    } = context;

    const displayTimeZone = constants.displayTimeZone || 'Asia/Shanghai';
    const currencyViewStorageKey = constants.currencyViewStorageKey || 'multipage-account-cost-ledger-currency-view';
    const usdCnyRateCacheStorageKey = constants.usdCnyRateCacheStorageKey || 'multipage-account-cost-ledger-usd-cny-rate-cache';
    const usdCnyRateApiUrl = constants.usdCnyRateApiUrl || 'https://open.er-api.com/v6/latest/USD';
    const rateProviderLabel = constants.rateProviderLabel || 'ExchangeRate-API';
    const usdLikeProviders = new Set(
      (Array.isArray(constants.usdLikeProviders) && constants.usdLikeProviders.length
        ? constants.usdLikeProviders
        : ['hotmail007', 'luckmail-api', 'hero-sms', '5sim', 'nexsms']
      ).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)
    );
    const storage = helpers?.storage || globalScope?.localStorage || null;
    const fetchImpl = typeof helpers?.fetch === 'function'
      ? helpers.fetch
      : (typeof globalScope?.fetch === 'function'
        ? globalScope.fetch.bind(globalScope)
        : (typeof fetch === 'function' ? fetch.bind(globalThis) : null));

    let eventsBound = false;
    let currencyView = loadCurrencyView();
    let usdCnyRateCache = loadUsdCnyRateCache();

    function escapeHtml(value) {
      if (typeof helpers.escapeHtml === 'function') {
        return helpers.escapeHtml(String(value || ''));
      }
      return String(value || '');
    }

    function normalizeTimestamp(value) {
      const timestamp = Date.parse(String(value || ''));
      return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function normalizeCostAmount(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0) {
        return null;
      }
      return Math.round(numeric * 10000) / 10000;
    }

    function normalizeCurrencyCode(value = '') {
      return String(value || '').trim().toUpperCase();
    }

    function normalizeCurrencyView(value = '') {
      return String(value || '').trim().toLowerCase() === 'cny' ? 'cny' : 'native';
    }

    function normalizeRateValue(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
      }
      return Math.round(numeric * 10000) / 10000;
    }

    function isUsdLikeProvider(value = '') {
      return usdLikeProviders.has(String(value || '').trim().toLowerCase());
    }

    function inferCurrencyFromProvider(value = '') {
      return isUsdLikeProvider(value) ? 'USD' : '';
    }

    function formatCostAmount(value, currency = '') {
      const amount = normalizeCostAmount(value);
      if (amount === null) {
        return '--';
      }
      const formatted = amount.toFixed(4);
      const normalizedCurrency = normalizeCurrencyCode(currency);
      return normalizedCurrency ? `${formatted} ${normalizedCurrency}` : formatted;
    }

    function getStorageItem(key) {
      if (!storage || typeof storage.getItem !== 'function') {
        return null;
      }
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    }

    function setStorageItem(key, value) {
      if (!storage || typeof storage.setItem !== 'function') {
        return;
      }
      try {
        storage.setItem(key, value);
      } catch {}
    }

    function loadCurrencyView() {
      return normalizeCurrencyView(getStorageItem(currencyViewStorageKey));
    }

    function persistCurrencyView(nextView) {
      currencyView = normalizeCurrencyView(nextView);
      setStorageItem(currencyViewStorageKey, currencyView);
      return currencyView;
    }

    function normalizeUsdCnyRateCache(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }
      const rate = normalizeRateValue(value.rate);
      if (rate === null) {
        return null;
      }
      const fetchedAt = String(value.fetchedAt || '').trim() || new Date().toISOString();
      const nextUpdateAt = String(value.nextUpdateAt || '').trim();
      return {
        rate,
        fetchedAt,
        nextUpdateAt,
      };
    }

    function loadUsdCnyRateCache() {
      const rawValue = getStorageItem(usdCnyRateCacheStorageKey);
      if (!rawValue) {
        return null;
      }
      try {
        return normalizeUsdCnyRateCache(JSON.parse(rawValue));
      } catch {
        return null;
      }
    }

    function persistUsdCnyRateCache(nextRateCache) {
      usdCnyRateCache = normalizeUsdCnyRateCache(nextRateCache);
      if (!usdCnyRateCache) {
        return null;
      }
      setStorageItem(usdCnyRateCacheStorageKey, JSON.stringify(usdCnyRateCache));
      return usdCnyRateCache;
    }

    function isUsdCnyRateCacheFresh(rateCache) {
      if (!rateCache?.rate) {
        return false;
      }
      const fetchedAt = Date.parse(String(rateCache.fetchedAt || ''));
      if (!Number.isFinite(fetchedAt)) {
        return false;
      }
      const nextUpdateAt = Date.parse(String(rateCache.nextUpdateAt || ''));
      const now = Date.now();
      if (Number.isFinite(nextUpdateAt)) {
        return nextUpdateAt > now;
      }
      return now - fetchedAt < 12 * 60 * 60 * 1000;
    }

    async function fetchUsdCnyRate() {
      if (typeof fetchImpl !== 'function') {
        throw new Error('当前环境不支持汇率请求。');
      }
      const response = await fetchImpl(usdCnyRateApiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });
      if (!response?.ok) {
        throw new Error(`汇率接口请求失败（HTTP ${response?.status || 0}）。`);
      }
      const payload = await response.json();
      const rate = normalizeRateValue(payload?.rates?.CNY);
      if (rate === null) {
        throw new Error('汇率接口未返回可用的 USD/CNY 数据。');
      }
      const lastUpdateMs = Number(payload?.time_last_update_unix) * 1000;
      const nextUpdateMs = Number(payload?.time_next_update_unix) * 1000;
      return persistUsdCnyRateCache({
        rate,
        fetchedAt: Number.isFinite(lastUpdateMs) ? new Date(lastUpdateMs).toISOString() : new Date().toISOString(),
        nextUpdateAt: Number.isFinite(nextUpdateMs) ? new Date(nextUpdateMs).toISOString() : '',
      });
    }

    async function ensureUsdCnyRate() {
      if (isUsdCnyRateCacheFresh(usdCnyRateCache)) {
        return usdCnyRateCache;
      }
      return fetchUsdCnyRate();
    }

    function resolveCostPartCurrency(part) {
      if (!part || typeof part !== 'object' || Array.isArray(part)) {
        return '';
      }
      const explicitCurrency = normalizeCurrencyCode(part.currency);
      if (explicitCurrency) {
        return explicitCurrency;
      }
      return inferCurrencyFromProvider(part.provider);
    }

    function resolveRecordTotalCurrency(record = {}) {
      const explicitCurrency = normalizeCurrencyCode(record?.costs?.total?.currency);
      if (explicitCurrency) {
        return explicitCurrency;
      }
      const candidates = [
        resolveCostPartCurrency(record?.costs?.mail),
        resolveCostPartCurrency(record?.costs?.phone),
      ].filter(Boolean);
      if (!candidates.length) {
        return '';
      }
      return candidates.every((value) => value === candidates[0]) ? candidates[0] : '';
    }

    function resolveLedgerEntryCurrency(entry = {}) {
      const explicitCurrency = normalizeCurrencyCode(entry?.currency);
      if (explicitCurrency) {
        return explicitCurrency;
      }
      return inferCurrencyFromProvider(entry?.provider);
    }

    function mapCurrencyTotalsToArray(totalsByCurrency = new Map()) {
      return [...totalsByCurrency.entries()]
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((left, right) => String(left.currency).localeCompare(String(right.currency)));
    }

    function createAverageEntries(totalEntries = [], divisor = 0) {
      const safeDivisor = Math.max(0, Math.floor(Number(divisor) || 0));
      return totalEntries.map((entry) => ({
        currency: entry.currency,
        amount: safeDivisor > 0
          ? Math.round((Number(entry.amount || 0) / safeDivisor) * 10000) / 10000
          : 0,
      }));
    }

    function convertEntriesForDisplay(entries = []) {
      const normalizedEntries = Array.isArray(entries) ? entries : [];
      if (currencyView !== 'cny') {
        return normalizedEntries.map((entry) => ({
          currency: normalizeCurrencyCode(entry?.currency),
          amount: normalizeCostAmount(entry?.amount) || 0,
        }));
      }

      if (!usdCnyRateCache?.rate) {
        return normalizedEntries.map((entry) => ({
          currency: normalizeCurrencyCode(entry?.currency),
          amount: normalizeCostAmount(entry?.amount) || 0,
        }));
      }

      const totalsByCurrency = new Map();
      normalizedEntries.forEach((entry) => {
        const amount = normalizeCostAmount(entry?.amount);
        if (amount === null) {
          return;
        }
        const rawCurrency = normalizeCurrencyCode(entry?.currency);
        const nextCurrency = rawCurrency === 'USD'
          ? 'CNY'
          : (rawCurrency === 'CNY' ? 'CNY' : rawCurrency);
        const nextAmount = rawCurrency === 'USD'
          ? Math.round((amount * usdCnyRateCache.rate) * 10000) / 10000
          : amount;
        totalsByCurrency.set(
          nextCurrency,
          Math.round(((totalsByCurrency.get(nextCurrency) || 0) + nextAmount) * 10000) / 10000
        );
      });
      return mapCurrencyTotalsToArray(totalsByCurrency);
    }

    function formatCurrencySummary(entries = []) {
      const displayEntries = convertEntriesForDisplay(entries);
      if (!displayEntries.length) {
        return '0.0000';
      }
      return displayEntries.map((entry) => formatCostAmount(entry.amount, entry.currency)).join(' / ');
    }

    function getAccountRunRecords(currentState = state.getLatestState()) {
      return (Array.isArray(currentState?.accountRunHistory) ? currentState.accountRunHistory : [])
        .filter((item) => item && typeof item === 'object')
        .slice()
        .sort((left, right) => normalizeTimestamp(right.finishedAt) - normalizeTimestamp(left.finishedAt));
    }

    function getAccountCostLedger(currentState = state.getLatestState()) {
      return Array.isArray(currentState?.accountCostLedger)
        ? currentState.accountCostLedger.filter((item) => item && typeof item === 'object')
        : [];
    }

    function summarizeSuccessCosts(records = []) {
      return records.reduce((summary, record) => {
        if (record?.finalStatus !== 'success') {
          return summary;
        }

        summary.successCount += 1;
        const totalCost = record?.costs?.total;
        const amount = normalizeCostAmount(totalCost?.amount);
        if (amount === null) {
          return summary;
        }

        summary.costTrackedSuccessCount += 1;
        const currency = resolveRecordTotalCurrency(record);
        summary.totalByCurrency.set(
          currency,
          Math.round(((summary.totalByCurrency.get(currency) || 0) + amount) * 10000) / 10000
        );
        return summary;
      }, {
        successCount: 0,
        costTrackedSuccessCount: 0,
        totalByCurrency: new Map(),
      });
    }

    function summarizeLedgerCosts(entries = [], successCount = 0) {
      const totalsByCurrency = new Map();
      let trackedEntryCount = 0;

      entries.forEach((entry) => {
        const outcome = String(entry?.outcome || 'consumed').trim().toLowerCase();
        if (outcome !== 'consumed') {
          return;
        }
        const amount = normalizeCostAmount(entry?.amount);
        if (amount === null) {
          return;
        }
        const currency = resolveLedgerEntryCurrency(entry);
        totalsByCurrency.set(
          currency,
          Math.round(((totalsByCurrency.get(currency) || 0) + amount) * 10000) / 10000
        );
        trackedEntryCount += 1;
      });

      const totalByCurrency = mapCurrencyTotalsToArray(totalsByCurrency);
      const averageByCurrency = createAverageEntries(totalByCurrency, successCount);

      return {
        trackedEntryCount,
        totalByCurrency,
        averageByCurrency,
      };
    }

    function getDayKey(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return '';
      }
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: displayTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    }

    function summarizeDailyCosts(records = [], ledgerEntries = []) {
      const dailyMap = new Map();

      function ensureDayEntry(dayKey) {
        if (!dayKey) {
          return null;
        }
        if (!dailyMap.has(dayKey)) {
          dailyMap.set(dayKey, {
            dayKey,
            successCount: 0,
            costTrackedSuccessCount: 0,
            successTotalByCurrency: new Map(),
            ledgerTotalByCurrency: new Map(),
          });
        }
        return dailyMap.get(dayKey);
      }

      records.forEach((record) => {
        if (record?.finalStatus !== 'success') {
          return;
        }
        const dayKey = getDayKey(record.finishedAt);
        const dayEntry = ensureDayEntry(dayKey);
        if (!dayEntry) {
          return;
        }
        dayEntry.successCount += 1;
        const amount = normalizeCostAmount(record?.costs?.total?.amount);
        if (amount === null) {
          return;
        }
        dayEntry.costTrackedSuccessCount += 1;
        const currency = resolveRecordTotalCurrency(record);
        dayEntry.successTotalByCurrency.set(
          currency,
          Math.round(((dayEntry.successTotalByCurrency.get(currency) || 0) + amount) * 10000) / 10000
        );
      });

      ledgerEntries.forEach((entry) => {
        const dayKey = getDayKey(entry?.createdAt);
        const dayEntry = ensureDayEntry(dayKey);
        if (!dayEntry) {
          return;
        }
        const outcome = String(entry?.outcome || 'consumed').trim().toLowerCase();
        if (outcome !== 'consumed') {
          return;
        }
        const amount = normalizeCostAmount(entry?.amount);
        if (amount === null) {
          return;
        }
        const currency = resolveLedgerEntryCurrency(entry);
        dayEntry.ledgerTotalByCurrency.set(
          currency,
          Math.round(((dayEntry.ledgerTotalByCurrency.get(currency) || 0) + amount) * 10000) / 10000
        );
      });

      return [...dailyMap.values()]
        .map((entry) => {
          const successTotals = mapCurrencyTotalsToArray(entry.successTotalByCurrency);
          const successAverageTotals = createAverageEntries(successTotals, entry.costTrackedSuccessCount);
          const ledgerTotals = mapCurrencyTotalsToArray(entry.ledgerTotalByCurrency);
          const amortizedTotals = createAverageEntries(ledgerTotals, entry.successCount);
          return {
            dayKey: entry.dayKey,
            successCount: entry.successCount,
            costTrackedSuccessCount: entry.costTrackedSuccessCount,
            successTotals,
            successAverageTotals,
            ledgerTotals,
            amortizedTotals,
          };
        })
        .sort((left, right) => String(right.dayKey).localeCompare(String(left.dayKey)));
    }

    function setNodeHidden(node, hidden) {
      if (node) {
        node.hidden = Boolean(hidden);
      }
    }

    function setNodeDisabled(node, disabled) {
      if (node) {
        node.disabled = Boolean(disabled);
      }
    }

    function createSummaryChip(label, value) {
      return `
        <div class="account-cost-ledger-summary-chip">
          <div class="account-cost-ledger-summary-chip-label">${escapeHtml(label)}</div>
          <div class="account-cost-ledger-summary-chip-value">${escapeHtml(value)}</div>
        </div>
      `;
    }

    function renderCurrencyControls() {
      if (dom.btnToggleAccountCostLedgerCurrency) {
        dom.btnToggleAccountCostLedgerCurrency.textContent = currencyView === 'cny' ? '显示原币' : '显示人民币';
      }
      if (!dom.accountCostLedgerRateMeta) {
        return;
      }
      if (currencyView !== 'cny' || !usdCnyRateCache?.rate) {
        dom.accountCostLedgerRateMeta.textContent = '';
        setNodeHidden(dom.accountCostLedgerRateMeta, true);
        return;
      }
      const rateText = `1 USD ≈ ${Number(usdCnyRateCache.rate).toFixed(4)} CNY · 汇率来源 ${rateProviderLabel}`;
      dom.accountCostLedgerRateMeta.textContent = rateText;
      setNodeHidden(dom.accountCostLedgerRateMeta, false);
    }

    function updateHeader(currentState = state.getLatestState()) {
      if (!dom.accountCostLedgerMeta) {
        return;
      }
      const records = getAccountRunRecords(currentState);
      const ledgerEntries = getAccountCostLedger(currentState);
      if (!records.length && !ledgerEntries.length) {
        dom.accountCostLedgerMeta.textContent = '暂无账本记录';
        return;
      }

      const successSummary = summarizeSuccessCosts(records);
      const latestRecordTime = records[0]?.finishedAt ? new Date(records[0].finishedAt) : null;
      const latestLedgerTime = ledgerEntries[0]?.createdAt ? new Date(ledgerEntries[0].createdAt) : null;
      const latestTime = [latestRecordTime, latestLedgerTime]
        .filter((item) => item instanceof Date && !Number.isNaN(item.getTime()))
        .sort((left, right) => right.getTime() - left.getTime())[0];

      const latestText = latestTime
        ? latestTime.toLocaleString('zh-CN', { hour12: false, timeZone: displayTimeZone })
        : '--';
      dom.accountCostLedgerMeta.textContent = `成功 ${successSummary.successCount} 条，已记账 ${successSummary.costTrackedSuccessCount} 条，账本 ${ledgerEntries.length} 条，最近更新于 ${latestText}`;
    }

    function renderSummary(currentState = state.getLatestState()) {
      if (!dom.accountCostLedgerSummary) {
        return;
      }

      const records = getAccountRunRecords(currentState);
      const successCostSummary = summarizeSuccessCosts(records);
      const successTotals = mapCurrencyTotalsToArray(successCostSummary.totalByCurrency);
      const successAverages = createAverageEntries(successTotals, successCostSummary.costTrackedSuccessCount);
      const ledgerSummary = summarizeLedgerCosts(
        getAccountCostLedger(currentState),
        successCostSummary.successCount
      );

      dom.accountCostLedgerSummary.innerHTML = [
        createSummaryChip('成功总数', String(successCostSummary.successCount)),
        createSummaryChip('已记账成功数', String(successCostSummary.costTrackedSuccessCount)),
        createSummaryChip('已记账成功总成本', formatCurrencySummary(successTotals)),
        createSummaryChip('已记账成功平均成本', formatCurrencySummary(successAverages)),
        createSummaryChip('全部消耗总成本', formatCurrencySummary(ledgerSummary.totalByCurrency)),
        createSummaryChip('每成功号摊销成本', formatCurrencySummary(ledgerSummary.averageByCurrency)),
      ].join('');
    }

    function renderDailyCostGroups(currentState = state.getLatestState()) {
      if (!dom.accountCostLedgerDailyList) {
        return;
      }

      const dailyEntries = summarizeDailyCosts(
        getAccountRunRecords(currentState),
        getAccountCostLedger(currentState)
      );
      if (!dailyEntries.length) {
        dom.accountCostLedgerDailyList.innerHTML = `
          <div class="account-cost-ledger-daily-empty">暂无按天成本记录</div>
        `;
        return;
      }

      dom.accountCostLedgerDailyList.innerHTML = dailyEntries.map((entry) => `
        <div class="account-cost-ledger-daily-item">
          <div class="account-cost-ledger-daily-top">
            <span class="account-cost-ledger-daily-date mono">${escapeHtml(entry.dayKey)}</span>
            <span class="account-cost-ledger-daily-success">成功 ${escapeHtml(String(entry.successCount))} · 已记账 ${escapeHtml(String(entry.costTrackedSuccessCount))}</span>
          </div>
          <div class="account-cost-ledger-daily-line">已记账成功总成本 ${escapeHtml(formatCurrencySummary(entry.successTotals))}</div>
          <div class="account-cost-ledger-daily-line">已记账成功平均成本 ${escapeHtml(formatCurrencySummary(entry.successAverageTotals))}</div>
          <div class="account-cost-ledger-daily-line">全部消耗总成本 ${escapeHtml(formatCurrencySummary(entry.ledgerTotals))}</div>
          <div class="account-cost-ledger-daily-line">每成功号摊销成本 ${escapeHtml(formatCurrencySummary(entry.amortizedTotals))}</div>
        </div>
      `).join('');
    }

    function render(currentState = state.getLatestState()) {
      renderCurrencyControls();
      updateHeader(currentState);
      renderSummary(currentState);
      renderDailyCostGroups(currentState);
      setNodeDisabled(dom.btnClearAccountCostLedger, getAccountCostLedger(currentState).length === 0);
    }

    function openPanel() {
      setNodeHidden(dom.accountCostLedgerOverlay, false);
      render();
    }

    function closePanel() {
      setNodeHidden(dom.accountCostLedgerOverlay, true);
    }

    async function clearCostLedger() {
      const ledgerEntries = getAccountCostLedger();
      if (!ledgerEntries.length) {
        helpers.showToast?.('No cost ledger entries to clear.', 'warn', 1800);
        return;
      }

      const confirmed = await helpers.openConfirmModal({
        title: 'Clear Cost Ledger',
        message: 'Clear the current cost ledger only? Account run records will be kept.',
        confirmLabel: 'Clear Ledger',
        confirmVariant: 'btn-danger',
      });
      if (!confirmed) {
        return;
      }

      const response = await runtime.sendMessage({
        type: 'CLEAR_ACCOUNT_COST_LEDGER',
        source: 'sidepanel',
      });
      if (response?.error) {
        throw new Error(response.error);
      }

      state.syncLatestState?.({ accountCostLedger: [] });
      helpers.showToast?.(`Cleared ${Math.max(0, Number(response?.clearedCount) || 0)} cost ledger entries.`, 'success', 2200);
    }

    async function toggleCurrencyView() {
      if (currencyView === 'cny') {
        persistCurrencyView('native');
        render();
        return;
      }

      await ensureUsdCnyRate();
      persistCurrencyView('cny');
      render();
    }

    function bindEvents() {
      if (eventsBound) {
        return;
      }
      eventsBound = true;

      dom.btnOpenAccountCostLedger?.addEventListener('click', () => {
        openPanel();
      });
      dom.btnCloseAccountCostLedger?.addEventListener('click', () => {
        closePanel();
      });
      dom.accountCostLedgerOverlay?.addEventListener('click', (event) => {
        if (event.target === dom.accountCostLedgerOverlay) {
          closePanel();
        }
      });
      dom.btnToggleAccountCostLedgerCurrency?.addEventListener('click', async () => {
        try {
          await toggleCurrencyView();
        } catch (error) {
          helpers.showToast?.(`Failed to switch ledger currency view: ${error.message}`, 'error');
        }
      });
      dom.btnClearAccountCostLedger?.addEventListener('click', async () => {
        try {
          await clearCostLedger();
        } catch (error) {
          helpers.showToast?.(`Failed to clear cost ledger: ${error.message}`, 'error');
        }
      });
      renderCurrencyControls();
    }

    function reset() {
      closePanel();
      render();
    }

    return {
      bindEvents,
      clearCostLedger,
      closePanel,
      ensureUsdCnyRate,
      openPanel,
      render,
      reset,
      summarizeDailyCosts,
      summarizeLedgerCosts,
      summarizeSuccessCosts,
      toggleCurrencyView,
    };
  }

  globalScope.SidepanelAccountCostLedgerManager = {
    createAccountCostLedgerManager,
  };
})(typeof window !== 'undefined' ? window : globalThis);
