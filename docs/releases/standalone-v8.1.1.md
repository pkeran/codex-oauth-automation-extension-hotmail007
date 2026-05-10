# Hotmail007 独立版 8.1.1

一次小版本补丁更新，主要用于同步当前稳定版版本号，并纳入最近一轮 Step 7 重开熔断修复。

## 本次变更

### 1. 版本号小更新

- `manifest.version = 8.1.1`
- `manifest.version_name = 8.1.1`

### 2. Step 7 重开兜底

- 修复后半段授权链路在同一轮内反复回到 Step 7 重开的缺口
- 当前同一 attempt 内，generic 的 Step 7 重开达到 3 次后，会升级为整轮 fresh attempt
- 避免在 7 → 8 → 9 → 10 → 7 的内循环里长时间卡住

## 当前文档入口

- 主 README：[`README.md`](../../README.md)
- 安装与配置指南：[`docs/安装与配置指南.md`](../%E5%AE%89%E8%A3%85%E4%B8%8E%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md)
- 发布说明：[`docs/独立版发布说明.md`](../%E7%8B%AC%E7%AB%8B%E7%89%88%E5%8F%91%E5%B8%83%E8%AF%B4%E6%98%8E.md)
- 历史来源：[`README.history.md`](../../README.history.md)

## Release / Tag 对应

- 当前版本：`8.1.1`
- 建议 Tag：`standalone-v8.1.1`
- 建议 Release 标题：`Hotmail007 独立版 8.1.1`
