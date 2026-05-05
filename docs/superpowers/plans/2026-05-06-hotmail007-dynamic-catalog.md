# Hotmail007 Dynamic Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Hotmail007 采购区支持动态类型列表、余额查询、库存刷新，以及仅对手动采购生效的批量入池数量。

**Architecture:** 后台新增 Hotmail007 目录/余额查询能力，并复用现有采购链路。前端不再写死类型选项，而是从远端价格目录渲染下拉与状态展示；自动运行仍固定单次补 1 个。

**Tech Stack:** Chrome extension background scripts, sidepanel DOM controller, Node test runner

---

### Task 1: 补失败测试

**Files:**
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\hotmail-utils.test.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-hotmail-manager.test.js`

- [ ] 为 `getMailPrice` 标准化、余额标准化、动态选项/数量传递写失败测试
- [ ] 运行针对性测试并确认按预期失败

### Task 2: 实现后台 Hotmail007 目录/余额/库存能力

**Files:**
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\hotmail-utils.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\background.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\background\message-router.js`

- [ ] 实现 `getMailPrice` 与 `balance` 相关 URL 构造和 payload 标准化
- [ ] 新增后台消息：价格目录、余额、库存、手动 quantity 采购
- [ ] 保持自动运行缺号补池 quantity=1 不变

### Task 3: 实现侧边栏动态 UI

**Files:**
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\sidepanel.html`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\sidepanel.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\hotmail-manager.js`
- Modify: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\sidepanel\sidepanel.css`

- [ ] 新增余额/库存/采购数量控件
- [ ] 动态渲染类型列表并展示 price/live/stock
- [ ] 手动采购消息带 quantity，状态文案同步更新

### Task 4: 验证

**Files:**
- Test: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\hotmail-utils.test.js`
- Test: `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007\tests\sidepanel-hotmail-manager.test.js`

- [ ] 跑针对性测试
- [ ] 跑 `npm test`
- [ ] 运行必要的 `node --check`
