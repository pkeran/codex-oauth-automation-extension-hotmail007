(function attachSidepanelAccountRecordsManager(globalScope) {
  function createAccountRecordsManager(context = {}) {
    const {
      state,
      dom,
      helpers,
      runtime,
      constants = {},
    } = context;

    const displayTimeZone = constants.displayTimeZone || 'Asia/Shanghai';
    const pageSize = Math.max(1, Math.floor(Number(constants.pageSize) || 10));

    const FILTER_CONFIG = {
      all: {
        label: '总',
        className: '',
        matches: () => true,
        metaLabel: '全部',
      },
      success: {
        label: '成',
        className: 'is-success',
        matches: (record) => record.finalStatus === 'success',
        metaLabel: '成功',
      },
      failed: {
        label: '失',
        className: 'is-failed',
        matches: (record) => record.finalStatus === 'failed',
        metaLabel: '失败',
      },
      stopped: {
        label: '停',
        className: 'is-stopped',
        matches: (record) => record.finalStatus === 'stopped',
        metaLabel: '停止',
      },
      retry: {
        label: '重试',
        className: 'is-retry',
        matches: (record) => normalizeRetryCount(record.retryCount) > 0,
        metaLabel: '重试',
      },
    };

    let currentPage = 1;
    let activeFilter = 'all';
    let selectionMode = false;
    let eventsBound = false;
    const selectedRecordIds = new Set();

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

    function normalizeRetryCount(value) {
      const count = Math.floor(Number(value) || 0);
      return count > 0 ? count : 0;
    }

    function isRecoveredSuccessRecord(record = {}) {
      if (record?.finalStatus !== 'success') {
        return false;
      }
      const reasons = Array.isArray(record?.recoveredFailureReasons)
        ? record.recoveredFailureReasons.filter(Boolean)
        : [];
      return Boolean(record?.recoveredSuccess) || reasons.length > 0;
    }

    function buildRecordId(record = {}) {
      const rawRecordId = String(record.recordId || '').trim();
      if (rawRecordId) {
        return rawRecordId.toLowerCase();
      }
      const rawIdentifierType = String(record.accountIdentifierType || '').trim().toLowerCase();
      const hasPhoneOnlyIdentifier = !record.email && (
        record.phoneNumber
        || record.phone
        || record.number
        || (record.accountIdentifier && !/@/.test(String(record.accountIdentifier || '')))
      );
      const identifierType = rawIdentifierType === 'phone'
        || (!rawIdentifierType && hasPhoneOnlyIdentifier)
        ? 'phone'
        : 'email';
      const identifier = String(
        record.accountIdentifier
        || (identifierType === 'phone' ? (record.phoneNumber || record.phone || record.number || '') : (record.email || ''))
        || ''
      ).trim();
      if (!identifier) {
        return '';
      }
      return identifierType === 'phone'
        ? `phone:${identifier.toLowerCase()}`
        : identifier.toLowerCase();
    }

    function getRecordIdentifierType(record = {}) {
      const rawType = String(record.accountIdentifierType || '').trim().toLowerCase();
      if (rawType === 'phone') {
        return 'phone';
      }
      if (rawType === 'email') {
        return 'email';
      }
      if (!record.email && (record.phoneNumber || record.phone || record.number)) {
        return 'phone';
      }
      if (!record.email && record.accountIdentifier && !/@/.test(String(record.accountIdentifier || ''))) {
        return 'phone';
      }
      return 'email';
    }

    function getRecordEmail(record = {}) {
      const identifierType = getRecordIdentifierType(record);
      return String(
        record.email
        || (identifierType === 'email' ? record.accountIdentifier : '')
        || ''
      ).trim();
    }

    function getRecordPhoneNumber(record = {}) {
      const identifierType = getRecordIdentifierType(record);
      return String(
        record.phoneNumber
        || record.phone
        || record.number
        || (identifierType === 'phone' ? record.accountIdentifier : '')
        || ''
      ).trim();
    }

    function getRecordPrimaryIdentifier(record = {}) {
      const identifierType = getRecordIdentifierType(record);
      const email = getRecordEmail(record);
      const phoneNumber = getRecordPhoneNumber(record);
      return identifierType === 'phone'
        ? (phoneNumber || String(record.accountIdentifier || '').trim() || email)
        : (email || String(record.accountIdentifier || '').trim() || phoneNumber);
    }

    function getRecordSecondaryIdentifier(record = {}) {
      const identifierType = getRecordIdentifierType(record);
      const email = getRecordEmail(record);
      const phoneNumber = getRecordPhoneNumber(record);
      if (identifierType === 'phone' && email) {
        return `邮箱 ${email}`;
      }
      if (identifierType !== 'phone' && phoneNumber) {
        return `绑定手机号 ${phoneNumber}`;
      }
      return '';
    }

    function getRecordTitle(record = {}) {
      const primaryIdentifier = getRecordPrimaryIdentifier(record) || '(空账号)';
      const secondaryIdentifier = getRecordSecondaryIdentifier(record);
      return secondaryIdentifier
        ? `${primaryIdentifier} / ${secondaryIdentifier}`
        : primaryIdentifier;
    }

    function getSignupMethodLabel(record = {}) {
      return String(record?.signupMethod || '').trim().toLowerCase() === 'phone'
        ? '手机号注册'
        : '邮箱注册';
    }

    function getAccountRunRecords(currentState = state.getLatestState()) {
      return (Array.isArray(currentState?.accountRunHistory) ? currentState.accountRunHistory : [])
        .filter((item) => item && typeof item === 'object')
        .slice()
        .sort((left, right) => normalizeTimestamp(right.finishedAt) - normalizeTimestamp(left.finishedAt));
    }

    function summarizeAccountRunHistory(records = []) {
      return records.reduce((summary, record) => {
        const retryCount = normalizeRetryCount(record.retryCount);
        summary.total += 1;
        if (record.finalStatus === 'success') {
          summary.success += 1;
          if (isRecoveredSuccessRecord(record)) {
            summary.recoveredSuccess += 1;
          }
        } else if (record.finalStatus === 'failed') {
          summary.failed += 1;
        } else if (record.finalStatus === 'stopped') {
          summary.stopped += 1;
        }
        if (retryCount > 0) {
          summary.retryRecordCount += 1;
        }
        summary.retryTotal += retryCount;
        return summary;
      }, {
        total: 0,
        success: 0,
        recoveredSuccess: 0,
        failed: 0,
        stopped: 0,
        retryRecordCount: 0,
        retryTotal: 0,
      });
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

    function formatCurrencySummary(entries = []) {
      if (!Array.isArray(entries) || !entries.length) {
        return '0.0000';
      }
      return entries.map((entry) => formatCostAmount(entry.amount, entry.currency)).join(' / ');
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

    function renderDailyCostGroups(currentState = state.getLatestState()) {
      if (!dom.accountRecordsDailyCosts) {
        return;
      }

      const dailyEntries = summarizeDailyCosts(
        getAccountRunRecords(currentState),
        getAccountCostLedger(currentState)
      );
      if (!dailyEntries.length) {
        dom.accountRecordsDailyCosts.innerHTML = `
          <div class="account-records-daily-empty">暂无按天成本记录</div>
        `;
        return;
      }

      dom.accountRecordsDailyCosts.innerHTML = dailyEntries.map((entry) => `
        <div class="account-records-daily-item">
          <div class="account-records-daily-top">
            <span class="account-records-daily-date mono">${escapeHtml(entry.dayKey)}</span>
            <span class="account-records-daily-success">成功 ${escapeHtml(String(entry.successCount))}</span>
          </div>
          <div class="account-records-daily-line">成功总成本 ${escapeHtml(formatCurrencySummary(entry.successTotals))}</div>
          <div class="account-records-daily-line">全部消耗总成本 ${escapeHtml(formatCurrencySummary(entry.ledgerTotals))}</div>
          <div class="account-records-daily-line">成功摊销平均成本 ${escapeHtml(formatCurrencySummary(entry.amortizedTotals))}</div>
        </div>
      `).join('');
    }

    function formatAccountRecordTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return '--:--';
      }

      const now = new Date();
      const sameYear = date.getFullYear() === now.getFullYear();
      const sameDay = date.toDateString() === now.toDateString();

      if (sameDay) {
        return date.toLocaleTimeString('zh-CN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          timeZone: displayTimeZone,
        });
      }

      return date.toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...(sameYear ? {} : { year: '2-digit' }),
        timeZone: displayTimeZone,
      }).replace(/\//g, '-');
    }

    function getStatusMeta(record = {}) {
      if (record.finalStatus === 'success') {
        return { kind: 'success', label: '成功' };
      }
      if (record.finalStatus === 'stopped') {
        return { kind: 'stopped', label: '停止' };
      }
      return { kind: 'failed', label: '失败' };
    }

    function getRecordSummaryText(record = {}) {
      if (record.finalStatus === 'success') {
        return '流程完成';
      }

      return String(record.failureLabel || '').trim() || '流程失败';
    }

    function getFilterConfig(filterKey = activeFilter) {
      return FILTER_CONFIG[filterKey] || FILTER_CONFIG.all;
    }

    function getRecordSummaryText(record = {}) {
      const signupMethodLabel = getSignupMethodLabel(record);
      const failureLabel = String(record.failureLabel || '').trim();
      if (record.finalStatus === 'success') {
        return `${signupMethodLabel} · 流程完成`;
      }

      return `${signupMethodLabel} · ${failureLabel || '流程失败'}`;
    }

    function getFilteredRecords(records = []) {
      const filterConfig = getFilterConfig(activeFilter);
      return records.filter((record) => filterConfig.matches(record));
    }

    function pruneSelectedRecordIds(records = []) {
      const availableIds = new Set(records.map((record) => buildRecordId(record)).filter(Boolean));
      for (const recordId of Array.from(selectedRecordIds)) {
        if (!availableIds.has(recordId)) {
          selectedRecordIds.delete(recordId);
        }
      }
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

    function toggleNodeClass(node, className, enabled) {
      if (!node || !className) {
        return;
      }
      if (node.classList && typeof node.classList.toggle === 'function') {
        node.classList.toggle(className, Boolean(enabled));
      }
    }

    function setNodeText(node, value) {
      if (node) {
        node.textContent = String(value || '');
      }
    }

    function setNodeAttr(node, name, value) {
      if (!node || !name) {
        return;
      }
      if (typeof node.setAttribute === 'function') {
        node.setAttribute(name, String(value));
        return;
      }
      node[name] = value;
    }

    function getDatasetValue(node, attrName) {
      if (!node || !attrName) {
        return '';
      }

      if (typeof node.getAttribute === 'function') {
        return String(node.getAttribute(attrName) || '');
      }

      const dataKey = attrName
        .replace(/^data-/, '')
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      return String(node.dataset?.[dataKey] || '');
    }

    function findClosest(target, selector) {
      if (!target || typeof target.closest !== 'function') {
        return null;
      }
      try {
        return target.closest(selector);
      } catch {
        return null;
      }
    }

    function createStatChip(filterKey, value) {
      const filterConfig = getFilterConfig(filterKey);
      const classNames = [
        'account-records-stat',
        filterConfig.className,
        activeFilter === filterKey ? 'is-active' : '',
      ].filter(Boolean).join(' ');

      return `
        <button
          type="button"
          class="${classNames}"
          data-account-record-filter="${escapeHtml(filterKey)}"
          aria-pressed="${activeFilter === filterKey ? 'true' : 'false'}"
        >
          <strong>${escapeHtml(String(value))}</strong>${escapeHtml(filterConfig.label)}
        </button>
      `;
    }

    function createInfoStatChip(label, value, className = '') {
      const classNames = [
        'account-records-stat',
        'is-info',
        className,
      ].filter(Boolean).join(' ');

      return `
        <div class="${classNames}">
          <strong>${escapeHtml(String(value))}</strong>${escapeHtml(label)}
        </div>
      `;
    }

    function updateHeader(allRecords, filteredRecords) {
      if (!dom.accountRecordsMeta) {
        return;
      }

      if (!allRecords.length) {
        dom.accountRecordsMeta.textContent = '暂无账号记录';
        return;
      }

      const latestTime = formatAccountRecordTime(allRecords[0]?.finishedAt);
      let metaText = `共 ${allRecords.length} 条，最近更新于 ${latestTime}`;

      if (activeFilter !== 'all') {
        metaText = `共 ${allRecords.length} 条，当前筛选 ${getFilterConfig(activeFilter).metaLabel} ${filteredRecords.length} 条，最近更新于 ${latestTime}`;
      }

      if (selectionMode) {
        metaText += `，已选 ${selectedRecordIds.size} 条`;
      }

      dom.accountRecordsMeta.textContent = metaText;
    }

    function updateStats(allRecords) {
      if (!dom.accountRecordsStats) {
        return;
      }

      const summary = summarizeAccountRunHistory(allRecords);
      dom.accountRecordsStats.innerHTML = [
        createStatChip('all', summary.total),
        createStatChip('success', summary.success),
        createInfoStatChip('最终成功', summary.success, 'is-success'),
        createInfoStatChip('恢复后成功', summary.recoveredSuccess, 'is-success'),
        createStatChip('failed', summary.failed),
        createStatChip('stopped', summary.stopped),
        createStatChip('retry', summary.retryTotal),
      ].join('');
    }

    function updateToolbarState(allRecords) {
      const totalRecords = allRecords.length;
      setNodeDisabled(dom.btnClearAccountRecords, totalRecords === 0);
      setNodeDisabled(dom.btnToggleAccountRecordsSelection, totalRecords === 0);
      setNodeHidden(dom.btnClearAccountRecords, selectionMode);
      toggleNodeClass(dom.btnToggleAccountRecordsSelection, 'is-active', selectionMode);
      setNodeAttr(dom.btnToggleAccountRecordsSelection, 'aria-pressed', selectionMode ? 'true' : 'false');
      setNodeText(dom.btnToggleAccountRecordsSelection, selectionMode ? '取消多选' : '多选');

      const selectedCount = selectedRecordIds.size;
      setNodeHidden(dom.btnDeleteSelectedAccountRecords, !selectionMode);
      setNodeDisabled(dom.btnDeleteSelectedAccountRecords, selectedCount === 0);
      setNodeText(
        dom.btnDeleteSelectedAccountRecords,
        selectedCount > 0 ? `删除选中(${selectedCount})` : '删除选中'
      );
    }

    function updatePagination(totalRecords) {
      const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / pageSize) : 0;
      if (totalPages === 0) {
        currentPage = 1;
      } else if (currentPage > totalPages) {
        currentPage = totalPages;
      } else if (currentPage < 1) {
        currentPage = 1;
      }

      setNodeText(dom.accountRecordsPageLabel, totalPages > 0 ? `${currentPage} / ${totalPages}` : '0 / 0');
      setNodeDisabled(dom.btnAccountRecordsPrev, totalPages <= 1 || currentPage <= 1);
      setNodeDisabled(dom.btnAccountRecordsNext, totalPages <= 1 || currentPage >= totalPages);

      return totalPages;
    }

    function renderEmptyState(allRecords) {
      if (!dom.accountRecordsList) {
        return;
      }

      const message = allRecords.length
        ? `当前筛选“${getFilterConfig(activeFilter).metaLabel}”下暂无记录`
        : '暂无账号记录';
      dom.accountRecordsList.innerHTML = `<div class="account-records-empty">${escapeHtml(message)}</div>`;
    }

    function renderRecordList(allRecords, filteredRecords) {
      if (!dom.accountRecordsList) {
        return;
      }

      const totalPages = updatePagination(filteredRecords.length);
      if (!filteredRecords.length) {
        renderEmptyState(allRecords);
        return;
      }

      const startIndex = (currentPage - 1) * pageSize;
      const visibleRecords = filteredRecords.slice(startIndex, startIndex + pageSize);

      dom.accountRecordsList.innerHTML = visibleRecords.map((record) => {
        const recordId = buildRecordId(record);
        const primaryIdentifier = getRecordPrimaryIdentifier(record) || '(空账号)';
        const secondaryIdentifier = getRecordSecondaryIdentifier(record);
        const recordTitle = getRecordTitle(record);
        const statusMeta = getStatusMeta(record);
        const summaryText = getRecordSummaryText(record);
        const retryCount = normalizeRetryCount(record.retryCount);
        const costSummary = record?.costs?.total ? formatCostAmount(record.costs.total.amount, record.costs.total.currency) : '';
        const costDetails = record?.costs ? [
          record.costs.mail ? `邮箱 ${formatCostAmount(record.costs.mail.amount, record.costs.mail.currency)}` : '',
          record.costs.phone ? `手机 ${formatCostAmount(record.costs.phone.amount, record.costs.phone.currency)}` : '',
        ].filter(Boolean).join(' | ') : '';
        const isSelected = selectedRecordIds.has(recordId);
        const itemClassNames = [
          'account-record-item',
          `is-${statusMeta.kind}`,
          selectionMode ? 'is-selectable' : '',
          isSelected ? 'is-selected' : '',
        ].filter(Boolean).join(' ');
        const selectionMarkup = selectionMode
          ? `
              <label class="account-record-item-check" data-account-record-toggle="${escapeHtml(recordId)}">
                <input
                  type="checkbox"
                  data-account-record-checkbox="${escapeHtml(recordId)}"
                  ${isSelected ? 'checked' : ''}
                />
              </label>
            `
          : '';

        return `
          <div
            class="${itemClassNames}"
            data-account-record-id="${escapeHtml(recordId)}"
            title="${escapeHtml(recordTitle)}"
          >
            <div class="account-record-item-top">
              <div class="account-record-item-email-row">
                ${selectionMarkup}
                <div class="account-record-item-identity">
                  <div class="account-record-item-email mono">${escapeHtml(primaryIdentifier)}</div>
                  ${secondaryIdentifier ? `<div class="account-record-item-secondary mono">${escapeHtml(secondaryIdentifier)}</div>` : ''}
                </div>
              </div>
              <div class="account-record-item-side">
                <span class="account-record-item-status">${escapeHtml(statusMeta.label)}</span>
                <span class="account-record-item-time mono">${escapeHtml(formatAccountRecordTime(record.finishedAt))}</span>
              </div>
            </div>
            <div class="account-record-item-bottom">
              <div class="account-record-item-summary">${escapeHtml(summaryText)}</div>
              <span class="account-record-item-retry mono">重试 ${escapeHtml(String(retryCount))}</span>
            </div>
            ${costSummary ? `
              <div class="account-record-item-costs mono">
                <div class="account-record-item-cost-total">总成本 ${escapeHtml(costSummary)}</div>
                ${costDetails ? `<div class="account-record-item-cost-breakdown">${escapeHtml(costDetails)}</div>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      if (totalPages <= 1) {
        setNodeText(dom.accountRecordsPageLabel, '1 / 1');
      }
    }

    function render(currentState = state.getLatestState()) {
      const allRecords = getAccountRunRecords(currentState);
      pruneSelectedRecordIds(allRecords);

      if (!allRecords.length) {
        selectionMode = false;
      }

      const filteredRecords = getFilteredRecords(allRecords);
      updateHeader(allRecords, filteredRecords);
      updateStats(allRecords);
      updateToolbarState(allRecords);
      renderRecordList(allRecords, filteredRecords);
    }

    function openPanel() {
      setNodeHidden(dom.accountRecordsOverlay, false);
      render();
    }

    function closePanel() {
      setNodeHidden(dom.accountRecordsOverlay, true);
    }

    function resetSelection() {
      selectedRecordIds.clear();
    }

    function setSelectionMode(nextValue) {
      const nextSelectionMode = Boolean(nextValue);
      if (!nextSelectionMode) {
        resetSelection();
      }
      selectionMode = nextSelectionMode;
      currentPage = 1;
      render();
    }

    function toggleSelectionMode() {
      setSelectionMode(!selectionMode);
    }

    function toggleRecordSelection(recordId, forceSelected = null) {
      const normalizedRecordId = String(recordId || '').trim().toLowerCase();
      if (!selectionMode || !normalizedRecordId) {
        return;
      }

      const shouldSelect = forceSelected === null
        ? !selectedRecordIds.has(normalizedRecordId)
        : Boolean(forceSelected);

      if (shouldSelect) {
        selectedRecordIds.add(normalizedRecordId);
      } else {
        selectedRecordIds.delete(normalizedRecordId);
      }
    }

    async function clearRecords() {
      const records = getAccountRunRecords();
      if (!records.length) {
        helpers.showToast?.('没有可清理的账号记录。', 'warn', 1800);
        return;
      }

      const confirmed = await helpers.openConfirmModal({
        title: '清理账号记录',
        message: '确认清理当前全部账号记录吗？该操作会同时清空面板记录与本地同步快照。',
        confirmLabel: '确认清理',
        confirmVariant: 'btn-danger',
      });
      if (!confirmed) {
        return;
      }

      const response = await runtime.sendMessage({
        type: 'CLEAR_ACCOUNT_RUN_HISTORY',
        source: 'sidepanel',
      });
      if (response?.error) {
        throw new Error(response.error);
      }

      activeFilter = 'all';
      currentPage = 1;
      selectionMode = false;
      resetSelection();
      state.syncLatestState({ accountRunHistory: [] });
      helpers.showToast?.(`已清理 ${Math.max(0, Number(response?.clearedCount) || 0)} 条账号记录。`, 'success', 2200);
    }

    async function deleteSelectedRecords() {
      const recordIds = Array.from(selectedRecordIds).filter(Boolean);
      if (!recordIds.length) {
        helpers.showToast?.('请先勾选要删除的账号记录。', 'warn', 1800);
        return;
      }

      const confirmed = await helpers.openConfirmModal({
        title: '删除选中记录',
        message: `确认删除选中的 ${recordIds.length} 条账号记录吗？该操作会同步更新本地 helper 快照。`,
        confirmLabel: '确认删除',
        confirmVariant: 'btn-danger',
      });
      if (!confirmed) {
        return;
      }

      const response = await runtime.sendMessage({
        type: 'DELETE_ACCOUNT_RUN_HISTORY_RECORDS',
        source: 'sidepanel',
        payload: {
          recordIds,
        },
      });
      if (response?.error) {
        throw new Error(response.error);
      }

      const existingRecords = getAccountRunRecords();
      const selectedIds = new Set(recordIds);
      const nextRecords = existingRecords.filter((record) => !selectedIds.has(buildRecordId(record)));

      resetSelection();
      state.syncLatestState({ accountRunHistory: nextRecords });
      helpers.showToast?.(`已删除 ${Math.max(0, Number(response?.deletedCount) || 0)} 条账号记录。`, 'success', 2200);
    }

    function handleStatsClick(event) {
      const filterNode = findClosest(event?.target, '[data-account-record-filter]');
      if (!filterNode) {
        return;
      }

      const nextFilter = getDatasetValue(filterNode, 'data-account-record-filter');
      if (!FILTER_CONFIG[nextFilter]) {
        return;
      }

      activeFilter = activeFilter === nextFilter && nextFilter !== 'all'
        ? 'all'
        : nextFilter;
      currentPage = 1;
      render();
    }

    function handleRecordListClick(event) {
      if (!selectionMode) {
        return;
      }

      const toggleNode = findClosest(event?.target, '[data-account-record-toggle]');
      if (toggleNode) {
        const recordId = getDatasetValue(toggleNode, 'data-account-record-toggle');
        const explicitChecked = typeof event?.target?.checked === 'boolean' ? event.target.checked : null;
        toggleRecordSelection(recordId, explicitChecked);
        render();
        return;
      }

      const recordNode = findClosest(event?.target, '[data-account-record-id]');
      if (!recordNode) {
        return;
      }

      toggleRecordSelection(getDatasetValue(recordNode, 'data-account-record-id'));
      render();
    }

    function bindEvents() {
      if (eventsBound) {
        return;
      }
      eventsBound = true;

      dom.btnOpenAccountRecords?.addEventListener('click', () => {
        openPanel();
      });
      dom.btnCloseAccountRecords?.addEventListener('click', () => {
        closePanel();
      });
      dom.accountRecordsOverlay?.addEventListener('click', (event) => {
        if (event.target === dom.accountRecordsOverlay) {
          closePanel();
        }
      });
      dom.accountRecordsStats?.addEventListener('click', (event) => {
        handleStatsClick(event);
      });
      dom.accountRecordsList?.addEventListener('click', (event) => {
        handleRecordListClick(event);
      });
      dom.btnAccountRecordsPrev?.addEventListener('click', () => {
        if (currentPage <= 1) {
          return;
        }
        currentPage -= 1;
        render();
      });
      dom.btnAccountRecordsNext?.addEventListener('click', () => {
        currentPage += 1;
        render();
      });
      dom.btnToggleAccountRecordsSelection?.addEventListener('click', () => {
        toggleSelectionMode();
      });
      dom.btnDeleteSelectedAccountRecords?.addEventListener('click', async () => {
        try {
          await deleteSelectedRecords();
        } catch (error) {
          helpers.showToast?.(`Failed to delete account run records: ${error.message}`, 'error');
        }
      });
      dom.btnClearAccountRecords?.addEventListener('click', async () => {
        try {
          await clearRecords();
        } catch (error) {
          helpers.showToast?.(`Failed to clear account run records: ${error.message}`, 'error');
        }
      });
    }

    function reset() {
      currentPage = 1;
      activeFilter = 'all';
      selectionMode = false;
      resetSelection();
      closePanel();
      render();
    }

    return {
      bindEvents,
      clearRecords,
      closePanel,
      deleteSelectedRecords,
      openPanel,
      render,
      reset,
      setSelectionMode,
      summarizeAccountRunHistory,
      toggleSelectionMode,
    };
  }

  globalScope.SidepanelAccountRecordsManager = {
    createAccountRecordsManager,
  };
})(typeof window !== 'undefined' ? window : globalThis);
