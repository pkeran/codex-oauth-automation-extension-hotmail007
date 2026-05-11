# Hotmail007 独立版 8.1.3

本次是一个以稳定性和状态机一致性为核心的小版本补丁更新，主要落地了参考上游 9.3 的 Top 5 优化项。

## 本次变更

### 1. 运行态记录与自动恢复

- 自动运行过程中新增 `running` 运行态记录
- 增加 step-idle watchdog
- 当某一步长时间无新进展时，会触发当前 attempt 的恢复逻辑，而不是静默卡住

### 2. auth 状态兜底

- 在内容脚本失联时，为 Step 8 / Step 9 增加 auth snapshot fallback
- 不再只依赖内容脚本返回 `null` 后盲重试

### 3. failedStep 显式传播

- 失败步骤不再主要依赖错误文案反推
- 账号记录、失败标签、后续统计使用更明确的 `failedStep`

### 4. stale step message 抑制

- 旧步骤消息不再轻易覆盖当前步骤状态
- 减少步骤重开、tab 复用、auth chain 重附着时的状态污染

### 5. 手机号页面状态探测防卡死

- 收敛 phone page-state probe 的超时
- 避免手机号验证链路被页面探测本身拖死

### 6. 版本号更新

- `manifest.version = 8.1.3`
- `manifest.version_name = 8.1.3`

## 验证

本轮已重新执行：

```powershell
npm test
```

结果：全量通过。

## 当前文档入口

- 主 README：[`README.md`](../../README.md)
- 安装与配置指南：[`docs/安装与配置指南.md`](../%E5%AE%89%E8%A3%85%E4%B8%8E%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md)
- 发布说明：[`docs/独立版发布说明.md`](../%E7%8B%AC%E7%AB%8B%E7%89%88%E5%8F%91%E5%B8%83%E8%AF%B4%E6%98%8E.md)
- 历史来源：[`README.history.md`](../../README.history.md)

## Release / Tag 对应

- 当前版本：`8.1.3`
- 建议 Tag：`standalone-v8.1.3`
- 建议 Release 标题：`Hotmail007 独立版 8.1.3`
