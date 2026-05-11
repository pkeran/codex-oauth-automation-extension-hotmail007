# Hotmail007 独立版 8.1.4

本次是一个小型稳定性补丁，目标很明确：

- 修复 Step 8 内部会直接回到 Step 7，绕过外层重开上限的问题
- 防止同一轮 attempt 在 Step 7 / Step 8 之间来回反复重开
- 将这类链路内循环统一升级为 `RESTART_CURRENT_ATTEMPT`，交给 auto-run controller 重新从当前轮 fresh attempt 开始

## 本次变更

### 1. Step 8 新增 attempt 内 Step 7 重开上限

- 在 `background/steps/fetch-login-code.js` 中新增 `STEP8_RERUN_STEP7_LIMIT_PER_ATTEMPT = 3`
- 为 Step 8 内部的 `rerunStep7ForStep8Recovery(...)` 加上本地计数
- 当同一 attempt 内连续触发过多次时，不再继续页内重开，而是直接抛出：
  - `code = RESTART_CURRENT_ATTEMPT`
  - `restartReasonCode = step8_rerun_step7_limit_exceeded`

### 2. 覆盖了两条真实绕过路径

本次不是只拦一种错误，而是把 Step 8 里两条会直接回到 Step 7 的恢复路径都纳入同一预算：

- 验证页 ready / retry / timeout 恢复分支
- 邮箱轮询失败、通信异常后回到 Step 7 的恢复分支

这样可以避免：

- Step 7 外层 cap 已有限制，但 Step 8 仍在内部偷偷继续回 Step 7
- 日志持续刷新导致 watchdog 不认定为卡死
- 用户体感上的“Step 7 无限循环”

### 3. 新增失败测试

新增测试文件：

- `tests/step8-rerun-step7-cap.test.js`

覆盖：

- repeated direct rerun-step7 recoveries
- repeated polling-driven rerun-step7 recoveries

## 验证

本轮已重新执行：

```powershell
node --test tests/step8-rerun-step7-cap.test.js tests/step8-restart-step7-error.test.js tests/step8-state-timeout-retry.test.js tests/step8-callback-handling.test.js tests/auto-run-step6-restart.test.js tests/verification-flow-structured-errors.test.js
npm test
```

结果：

- targeted tests 全通过
- 全量 `npm test` 全通过

## 当前文档入口

- 主 README：[`README.md`](../../README.md)
- 安装与配置指南：[`docs/安装与配置指南.md`](../%E5%AE%89%E8%A3%85%E4%B8%8E%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md)
- 发布说明：[`docs/独立版发布说明.md`](../%E7%8B%AC%E7%AB%8B%E7%89%88%E5%8F%91%E5%B8%83%E8%AF%B4%E6%98%8E.md)
- 历史来源：[`README.history.md`](../../README.history.md)

## Release / Tag 对应

- 当前版本：`8.1.4`
- 建议 Tag：`standalone-v8.1.4`
- 建议 Release 标题：`Hotmail007 独立版 8.1.4`
