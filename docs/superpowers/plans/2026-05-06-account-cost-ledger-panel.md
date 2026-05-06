# Account Cost Ledger Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“记账/成本账本”从“账号记录”面板中独立出来，改为配置菜单独立入口，同时保留记录面板中的单条记录成本明细。

**Architecture:** 保持 `accountRunHistory` 与 `accountCostLedger` 数据模型不变，只拆前端展示职责。现有 `account-records-manager.js` 瘦身为纯记录管理器，新建独立的 `account-cost-ledger-manager.js` 负责汇总统计、按天账本与清理账本，再由 `sidepanel.js` 统一装配两个 manager。

**Tech Stack:** Chrome extension sidepanel、原生 JavaScript、Node `--test` 测试框架、HTML/CSS。

---

## File Structure

- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\sidepanel.html`
  - 配置菜单新增“记账”入口
  - 新增独立 ledger overlay
  - 从 records overlay 移除 daily ledger 区与清理账本按钮
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\sidepanel.css`
  - 新增 `account-cost-ledger-*` 样式
  - 保留 `account-records-*` 仅服务记录面板
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\sidepanel.js`
  - 获取 ledger DOM
  - 初始化 ledger manager
  - 将配置菜单按钮接入 open/close 行为
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\account-records-manager.js`
  - 移除账本汇总、每日账本和清理账本职责
  - 保留单条记录成本明细
- Create: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\account-cost-ledger-manager.js`
  - 负责成本汇总、按天账本、清理账本、独立 overlay 控制
- Test: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-account-records-manager.test.js`
- Test: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-account-cost-daily.test.js`
- Test: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-header-links.test.js`
  - 如配置菜单按钮结构测试需要补充
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\manifest.json`
  - bump 版本号

## Task 1: 补 UI 结构失败测试

**Files:**
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-account-records-manager.test.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-account-cost-daily.test.js`

- [ ] **Step 1: 写记录面板 HTML 结构失败测试**

```js
test('sidepanel html separates account records overlay from cost ledger overlay', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

  assert.match(html, /id="btn-open-account-records"/);
  assert.match(html, /id="btn-open-account-cost-ledger"/);
  assert.match(html, /id="account-records-overlay"/);
  assert.match(html, /id="account-cost-ledger-overlay"/);

  assert.doesNotMatch(html, /id="account-records-daily-costs"/);
  assert.doesNotMatch(html, /id="btn-clear-account-cost-ledger"[\s\S]*id="account-records-overlay"/);
});
```

- [ ] **Step 2: 写账本面板独立行为失败测试**

```js
test('account cost ledger manager renders daily ledger groups and clears cost ledger independently', async () => {
  const source = fs.readFileSync('sidepanel/account-cost-ledger-manager.js', 'utf8');
  const windowObject = {};
  const api = new Function('window', `${source}; return window.SidepanelAccountCostLedgerManager;`)(windowObject);

  assert.equal(typeof api?.createAccountCostLedgerManager, 'function');
});
```

- [ ] **Step 3: 运行 targeted tests，确认红灯**

Run:

```powershell
npm test -- tests/sidepanel-account-records-manager.test.js tests/sidepanel-account-cost-daily.test.js
```

Expected:

- FAIL
- 失败点应集中在缺少 `btn-open-account-cost-ledger`、缺少 `account-cost-ledger-overlay`、缺少 `account-cost-ledger-manager.js`

- [ ] **Step 4: 提交测试红灯检查点**

```powershell
git add tests/sidepanel-account-records-manager.test.js tests/sidepanel-account-cost-daily.test.js
git commit -m "test: cover separated account cost ledger panel"
```

## Task 2: 拆 records overlay，加入 ledger overlay

**Files:**
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\sidepanel.html`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\sidepanel.css`

- [ ] **Step 1: 修改 sidepanel HTML，加入配置菜单入口与 ledger overlay**

```html
<div id="config-menu" class="header-dropdown" role="menu" aria-labelledby="btn-config-menu" hidden>
  <button id="btn-open-account-cost-ledger" class="header-dropdown-item" type="button" role="menuitem">记账</button>
  <button id="btn-export-settings" class="header-dropdown-item" type="button" role="menuitem">导出配置</button>
  <button id="btn-import-settings" class="header-dropdown-item" type="button" role="menuitem">导入配置</button>
</div>
```

```html
<div id="account-cost-ledger-overlay" class="account-cost-ledger-overlay" hidden>
  <div class="account-cost-ledger-panel">
    <div class="account-cost-ledger-panel-header">
      <div class="account-cost-ledger-panel-copy">
        <span class="account-cost-ledger-panel-title">记账</span>
        <span id="account-cost-ledger-meta" class="account-cost-ledger-panel-meta">暂无账本记录</span>
      </div>
      <button id="btn-close-account-cost-ledger" class="modal-close" type="button" aria-label="关闭">×</button>
    </div>
    <div id="account-cost-ledger-summary" class="account-cost-ledger-summary"></div>
    <div class="account-cost-ledger-toolbar">
      <button id="btn-clear-account-cost-ledger" class="btn btn-ghost btn-xs" type="button">清理账本</button>
    </div>
    <div id="account-cost-ledger-daily-list" class="account-cost-ledger-daily-list"></div>
  </div>
</div>
```

- [ ] **Step 2: 从 records overlay 删除 daily ledger 区和清理账本按钮**

```html
<div class="account-records-toolbar-actions">
  <button id="btn-toggle-account-records-selection" class="btn btn-ghost btn-xs" type="button">多选</button>
  <button id="btn-delete-selected-account-records" class="btn btn-ghost btn-xs" type="button" hidden disabled>删除选中</button>
  <button id="btn-clear-account-records" class="btn btn-ghost btn-xs" type="button">清理记录</button>
</div>
```

- [ ] **Step 3: 添加 ledger 面板样式**

```css
.account-cost-ledger-overlay {
  position: fixed;
  inset: 0;
  z-index: 1210;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: rgba(15, 17, 23, 0.32);
  backdrop-filter: blur(2px);
}

.account-cost-ledger-overlay[hidden] {
  display: none !important;
}

.account-cost-ledger-panel {
  width: min(100%, 420px);
  max-height: calc(100vh - 24px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}
```

- [ ] **Step 4: 运行 HTML/CSS 相关测试**

Run:

```powershell
npm test -- tests/sidepanel-account-records-manager.test.js
```

Expected:

- 结构测试从 “缺少节点” 前进到 “缺少 manager 接线” 或行为层失败

- [ ] **Step 5: 提交 HTML/CSS 检查点**

```powershell
git add sidepanel/sidepanel.html sidepanel/sidepanel.css tests/sidepanel-account-records-manager.test.js
git commit -m "feat: separate account cost ledger panel markup"
```

## Task 3: 新建 ledger manager 并瘦身 records manager

**Files:**
- Create: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\account-cost-ledger-manager.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\account-records-manager.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-account-cost-daily.test.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-account-records-manager.test.js`

- [ ] **Step 1: 新建 ledger manager failing contract 后的最小实现**

```js
(function attachSidepanelAccountCostLedgerManager(globalScope) {
  function createAccountCostLedgerManager(context = {}) {
    const { state, dom, helpers, runtime, constants = {} } = context;

    function render() {}
    function openPanel() {}
    function closePanel() {}
    function bindEvents() {}

    return {
      render,
      openPanel,
      closePanel,
      bindEvents,
    };
  }

  globalScope.SidepanelAccountCostLedgerManager = {
    createAccountCostLedgerManager,
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 2: 将账本汇总与按天账本逻辑迁入新 manager**

```js
function summarizeLedgerCosts(entries = [], successCount = 0) { /* 从 records manager 迁移 */ }
function summarizeDailyCosts(records = [], ledgerEntries = []) { /* 从 records manager 迁移 */ }
function renderDailyCostGroups(currentState = state.getLatestState()) { /* 渲染到 ledger dom */ }
function clearCostLedger() { /* 只调用 CLEAR_ACCOUNT_COST_LEDGER */ }
```

- [ ] **Step 3: 从 records manager 删除账本区职责，但保留单条记录成本明细**

```js
function render(currentState = state.getLatestState()) {
  const allRecords = getAccountRunRecords(currentState);
  pruneSelectedRecordIds(allRecords);
  if (!allRecords.length) {
    selectionMode = false;
  }
  const filteredRecords = getFilteredRecords(allRecords);
  updateHeader(allRecords, filteredRecords);
  updateStats(allRecords, currentState);
  updateToolbarState(allRecords);
  renderRecordList(allRecords, filteredRecords);
}
```

- [ ] **Step 4: 调整 records manager 的统计 chips 只保留记录类统计**

```js
dom.accountRecordsStats.innerHTML = [
  createStatChip('all', summary.total),
  createStatChip('success', summary.success),
  createStatChip('failed', summary.failed),
  createStatChip('stopped', summary.stopped),
  createStatChip('retry', summary.retryTotal),
].join('');
```

- [ ] **Step 5: 跑 manager 相关 targeted tests**

Run:

```powershell
npm test -- tests/sidepanel-account-records-manager.test.js tests/sidepanel-account-cost-daily.test.js
```

Expected:

- PASS
- 记录测试不再依赖 daily ledger DOM
- 账本测试改为使用 `account-cost-ledger-manager.js`

- [ ] **Step 6: 提交 manager 拆分检查点**

```powershell
git add sidepanel/account-records-manager.js sidepanel/account-cost-ledger-manager.js tests/sidepanel-account-records-manager.test.js tests/sidepanel-account-cost-daily.test.js
git commit -m "refactor: split account records and cost ledger managers"
```

## Task 4: 在 sidepanel.js 中接线两个 manager

**Files:**
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\sidepanel.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-header-links.test.js`

- [ ] **Step 1: 获取 ledger 面板 DOM**

```js
const btnOpenAccountCostLedger = document.getElementById('btn-open-account-cost-ledger');
const accountCostLedgerOverlay = document.getElementById('account-cost-ledger-overlay');
const accountCostLedgerMeta = document.getElementById('account-cost-ledger-meta');
const accountCostLedgerSummary = document.getElementById('account-cost-ledger-summary');
const accountCostLedgerDailyList = document.getElementById('account-cost-ledger-daily-list');
const btnCloseAccountCostLedger = document.getElementById('btn-close-account-cost-ledger');
```

- [ ] **Step 2: 初始化 ledger manager**

```js
const accountCostLedgerManager = window.SidepanelAccountCostLedgerManager?.createAccountCostLedgerManager({
  state: {
    getLatestState: () => latestState,
    syncLatestState,
  },
  dom: {
    accountCostLedgerDailyList,
    accountCostLedgerMeta,
    accountCostLedgerOverlay,
    accountCostLedgerSummary,
    btnClearAccountCostLedger,
    btnCloseAccountCostLedger,
    btnOpenAccountCostLedger,
  },
  helpers: {
    escapeHtml,
    openConfirmModal,
    showToast,
  },
  runtime: {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  },
  constants: {
    displayTimeZone: DISPLAY_TIMEZONE,
  },
});
```

- [ ] **Step 3: 在全局刷新路径中同时 render 两个 manager**

```js
const renderAccountCostLedger = accountCostLedgerManager?.render || (() => {});
```

```js
renderAccountRecords(latestState);
renderAccountCostLedger(latestState);
```

- [ ] **Step 4: 运行接线相关 tests**

Run:

```powershell
npm test -- tests/sidepanel-account-records-manager.test.js tests/sidepanel-account-cost-daily.test.js tests/sidepanel-header-links.test.js
```

Expected:

- PASS
- 配置菜单新增入口不会破坏原菜单行为

- [ ] **Step 5: 提交接线检查点**

```powershell
git add sidepanel/sidepanel.js tests/sidepanel-header-links.test.js
git commit -m "feat: wire account cost ledger panel into sidepanel"
```

## Task 5: 全量回归与版本号

**Files:**
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\manifest.json`

- [ ] **Step 1: bump 版本号**

```json
{
  "version": "4.6",
  "version_name": "Ultra6.6 Hotmail007"
}
```

- [ ] **Step 2: 跑标准全量测试**

Run:

```powershell
npm test
```

Expected:

- `pass > 0`
- `fail 0`

- [ ] **Step 3: 提交最终改动**

```powershell
git add sidepanel/sidepanel.html sidepanel/sidepanel.css sidepanel/sidepanel.js sidepanel/account-records-manager.js sidepanel/account-cost-ledger-manager.js tests/sidepanel-account-records-manager.test.js tests/sidepanel-account-cost-daily.test.js tests/sidepanel-header-links.test.js manifest.json
git commit -m "Separate account cost ledger panel from account records"
```
