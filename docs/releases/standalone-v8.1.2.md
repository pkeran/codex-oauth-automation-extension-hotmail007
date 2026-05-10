# Hotmail007 独立版 8.1.2

本次是一个面向稳定性的补丁版本，重点收口自动运行重试边界和成本快照统计口径。

## 本次变更

### 1. 自动运行 P0 修复

- 修复 Step 4 在同一 attempt 内可能无限回到 Step 1 的问题
- 为 `customMailProviderPool + autoRunSkipFailures` 增加同轮重试上限，避免单轮无限重试

### 2. 成本快照 P1 修复

- 修复账号运行记录成本快照混币种直接相加的问题
- 新快照在混币种场景下改为按币种分别记录，而不是生成错误的单一 `total`

### 3. 版本号更新

- `manifest.version = 8.1.2`
- `manifest.version_name = 8.1.2`

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

- 当前版本：`8.1.2`
- 建议 Tag：`standalone-v8.1.2`
- 建议 Release 标题：`Hotmail007 独立版 8.1.2`
