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
    let eventsBound = false;

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

    function formatCostAmount(value, currency = '') {
      const amount = normalizeCostAmount(value);
      if (amount === null) {
        return '--';
      }
      const formatted = amount.toFixed(4);
      const normalizedCurrency = String(currency || '').trim();
      return normalizedCurrency ? `${formatted} ${normalizedCurrency}` : formatted;
    }

    function formatCurrencySummary(entries = []) {
      if (!Array.isArray(entries) || !entries.length) {
        return '0.0000';
      }
      return entries.map((entry) => formatCostAmount(entry.amount, entry.currency)).join(' / ');
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

        const totalCost = record?.costs?.total;
        const amount = normalizeCostAmount(totalCost?.amount);
        if (amount === null) {
          return summary;
        }

        const currency = String(totalCost?.currency || '').trim();
        summary.successCount += 1;
        summary.totalByCurrency.set(
          currency,
          Math.round(((summary.totalByCurrency.get(currency) || 0) + amount) * 10000) / 10000
        );
        return summary;
      }, {
        successCount: 0,
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
        const currency = String(entry?.currency || '').trim();
        totalsByCurrency.set(
          currency,
          Math.round(((totalsByCurrency.get(currency) || 0) + amount) * 10000) / 10000
        );
        trackedEntryCount += 1;
      });

      const totalByCurrency = [...totalsByCurrency.entries()]
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((left, right) => String(left.currency).localeCompare(String(right.currency)));
      const averageByCurrency = totalByCurrency.map((entry) => ({
        currency: entry.currency,
        amount: successCount > 0
          ? Math.round((entry.amount / successCount) * 10000) / 10000
          : 0,
      }));

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
        const currency = String(record?.costs?.total?.currency || '').trim();
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
        const currency = String(entry?.currency || '').trim();
        dayEntry.ledgerTotalByCurrency.set(
          currency,
          Math.round(((dayEntry.ledgerTotalByCurrency.get(currency) || 0) + amount) * 10000) / 10000
        );
      });

      return [...dailyMap.values()]
        .map((entry) => {
          const successTotals = [...entry.successTotalByCurrency.entries()]
            .map(([currency, amount]) => ({ currency, amount }))
            .sort((left, right) => String(left.currency).localeCompare(String(right.currency)));
          const ledgerTotals = [...entry.ledgerTotalByCurrency.entries()]
            .map(([currency, amount]) => ({ currency, amount }))
            .sort((left, right) => String(left.currency).localeCompare(String(right.currency)));
          const amortizedTotals = ledgerTotals.map((item) => ({
            currency: item.currency,
            amount: entry.successCount > 0
              ? Math.round((item.amount / entry.successCount) * 10000) / 10000
              : 0,
          }));
          return {
            dayKey: entry.dayKey,
            successCount: entry.successCount,
            successTotals,
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

      const latestRecordTime = records[0]?.finishedAt ? new Date(records[0].finishedAt) : null;
      const latestLedgerTime = ledgerEntries[0]?.createdAt ? new Date(ledgerEntries[0].createdAt) : null;
      const latestTime = [latestRecordTime, latestLedgerTime]
        .filter((item) => item instanceof Date && !Number.isNaN(item.getTime()))
        .sort((left, right) => right.getTime() - left.getTime())[0];

      const latestText = latestTime
        ? latestTime.toLocaleString('zh-CN', { hour12: false, timeZone: displayTimeZone })
        : '--';
      dom.accountCostLedgerMeta.textContent = `成功 ${records.filter((item) => item?.finalStatus === 'success').length} 条，账本 ${ledgerEntries.length} 条，最近更新于 ${latestText}`;
    }

    function renderSummary(currentState = state.getLatestState()) {
      if (!dom.accountCostLedgerSummary) {
        return;
      }

      const records = getAccountRunRecords(currentState);
      const successCostSummary = summarizeSuccessCosts(records);
      const successTotals = [...successCostSummary.totalByCurrency.entries()]
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((left, right) => String(left.currency).localeCompare(String(right.currency)));
      const successAverages = successTotals.map((entry) => ({
        currency: entry.currency,
        amount: successCostSummary.successCount > 0
          ? Math.round((entry.amount / successCostSummary.successCount) * 10000) / 10000
          : 0,
      }));
      const ledgerSummary = summarizeLedgerCosts(
        getAccountCostLedger(currentState),
        successCostSummary.successCount
      );

      dom.accountCostLedgerSummary.innerHTML = [
        createSummaryChip('成功数', String(successCostSummary.successCount)),
        createSummaryChip('成功总成本', formatCurrencySummary(successTotals)),
        createSummaryChip('成功平均成本', formatCurrencySummary(successAverages)),
        createSummaryChip('全部消耗总成本', formatCurrencySummary(ledgerSummary.totalByCurrency)),
        createSummaryChip('成功摊销平均成本', formatCurrencySummary(ledgerSummary.averageByCurrency)),
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
            <span class="account-cost-ledger-daily-success">成功 ${escapeHtml(String(entry.successCount))}</span>
          </div>
          <div class="account-cost-ledger-daily-line">成功总成本 ${escapeHtml(formatCurrencySummary(entry.successTotals))}</div>
          <div class="account-cost-ledger-daily-line">全部消耗总成本 ${escapeHtml(formatCurrencySummary(entry.ledgerTotals))}</div>
          <div class="account-cost-ledger-daily-line">成功摊销平均成本 ${escapeHtml(formatCurrencySummary(entry.amortizedTotals))}</div>
        </div>
      `).join('');
    }

    function render(currentState = state.getLatestState()) {
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
      dom.btnClearAccountCostLedger?.addEventListener('click', async () => {
        try {
          await clearCostLedger();
        } catch (error) {
          helpers.showToast?.(`Failed to clear cost ledger: ${error.message}`, 'error');
        }
      });
    }

    function reset() {
      closePanel();
      render();
    }

    return {
      bindEvents,
      clearCostLedger,
      closePanel,
      openPanel,
      render,
      reset,
      summarizeDailyCosts,
      summarizeLedgerCosts,
      summarizeSuccessCosts,
    };
  }

  globalScope.SidepanelAccountCostLedgerManager = {
    createAccountCostLedgerManager,
  };
})(typeof window !== 'undefined' ? window : globalThis);
