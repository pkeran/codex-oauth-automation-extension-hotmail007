# Hotmail007 独立版 8.1

首个以独立仓库口径整理的发布基线。

## 本次发布定位

这个版本的重点不是新增某一个单点功能，而是把整个改版插件的仓库、文档与发布口径正式切到独立项目：

- 独立仓库主入口已确定
- README 已改为独立版说明
- 历史来源与发布说明已拆分
- 后续 tags / releases 不再沿用 fork 叙事

## 当前能力聚焦

### 1. 邮箱与账号池

- Hotmail007 长效邮箱采购、校验、导出
- Hotmail / LuckMail / 2925 / iCloud / 自定义邮箱池支持
- 邮箱模式与手机号模式运行态隔离

### 2. 手机接码恢复

- HeroSMS / 5sim / NexSMS 等 provider 策略
- add-phone 错误分类与换号恢复
- 手动复用 / 自动白嫖复用 / provider + phone 粒度状态管理

### 3. 自动运行稳定性

- Step 2 / 3 / 4 / 7 / 8 / 9 定向恢复
- structured code 分流
- never-stop 模式与阶段卡死回卷

### 4. 成本与记录

- 成本账本与账号记录分离
- 按天账本持久化
- 成功 / 失败成本快照

## 当前文档入口

- 主 README：[`README.md`](../../README.md)
- 安装与配置指南：[`docs/安装与配置指南.md`](../%E5%AE%89%E8%A3%85%E4%B8%8E%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md)
- 发布说明：[`docs/独立版发布说明.md`](../%E7%8B%AC%E7%AB%8B%E7%89%88%E5%8F%91%E5%B8%83%E8%AF%B4%E6%98%8E.md)
- 历史来源：[`README.history.md`](../../README.history.md)

## Release / Tag 约定

从这个版本开始：

- Git tag 使用：`standalone-v<version>`
- GitHub Release 标题使用：`Hotmail007 独立版 <version>`

当前对应：

- Tag：`standalone-v8.1`
- Release：`Hotmail007 独立版 8.1`
