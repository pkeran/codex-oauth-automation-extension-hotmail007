# Codex OAuth Automation Extension · Hotmail007 独立版

面向 Hotmail007 / 邮箱池 / 接码恢复场景持续维护的 Chrome 扩展分支。

当前仓库已经完成独立化迁移，后续版本、文档与发布都以本仓库为准：

- 独立仓库：[`pkeran/codex-oauth-automation-extension-hotmail007`](https://github.com/pkeran/codex-oauth-automation-extension-hotmail007)
- 默认发布分支：`main`
- 本地主开发分支：`dev`
- 当前扩展版本：`8.1.1`

## 仓库定位

这个仓库不再沿用原插件 README 的发布口径，而是只聚焦当前独立版正在维护的几条主线：

1. Hotmail007 长效邮箱采购、账号池、导出与可用性校验
2. HeroSMS / 5sim / NexSMS 等接码 provider 的换号恢复、复用控制与失败分流
3. Step 2 / 3 / 4 / 7 / 8 / 9 的结构化错误识别、自动恢复与重开策略
4. 成本账本、注册记录、按天持久化、导入导出与统计展示
5. 侧边栏配置收敛、独立记账入口、本地调试与监控辅助

如果你想使用的是“当前改版插件”，应该看这里，而不是再回旧 fork 或上游仓库找发布入口。

## 当前独立版核心能力

### 1. 邮箱与账号池

- Hotmail007 自动采购、预校验、长效邮箱导出
- Hotmail / LuckMail / 2925 / iCloud / 自定义邮箱池等多来源支持
- 邮箱模式与手机号模式的运行态隔离
- 账号记录中保留邮箱、手机号、注册方式、成本快照等信息

### 2. 手机接码链路

- 多 provider 顺序控制与回退
- add-phone 页面错误分类与换号恢复
- 手动复用 / 自动白嫖复用 / provider + phone 级状态隔离
- 对“无法发码”“验证码页 500”“号码失效”“页面限流”等场景做结构化处理

### 3. 自动运行稳定性

- Step 2 / Step 3 / Step 4 / Step 7 / Step 8 / Step 9 定向恢复
- never-stop 模式与阶段卡死超时回卷
- structured code 命中计数与同轮重开策略
- 在已消耗接码成本但后续失败时，尽量保留可继续使用的手机号上下文

### 4. 成本与账本

- 注册记录与账本分离
- 成功 / 失败成本快照
- 按天成本账本持久化
- 支持导入导出与面板聚合展示

### 5. 配置与侧边栏

- 接码设置分层折叠
- 独立记账入口
- Hotmail007 长效邮箱导出入口
- 多类错误、恢复、状态与日志可视化增强

## 与上游仓库的关系

当前仓库仍然保留上游来源说明，但维护策略已经变成“按补丁移植”，而不是整批覆盖：

- 上游来源：`QLHazyCoder/codex-oauth-automation-extension`
- 当前策略：只挑有价值的修复点迁移到独立版
- 推荐流程：先补失败测试，再最小实现，最后跑 targeted tests 和 `npm test`

相关背景可看：

- 历史来源文档：[`README.history.md`](README.history.md)
- 独立版发布说明：[`docs/独立版发布说明.md`](docs/%E7%8B%AC%E7%AB%8B%E7%89%88%E5%8F%91%E5%B8%83%E8%AF%B4%E6%98%8E.md)
- 安装与配置指南：[`docs/安装与配置指南.md`](docs/%E5%AE%89%E8%A3%85%E4%B8%8E%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md)
- 当前独立版 Release Notes：[`docs/releases/standalone-v8.1.1.md`](docs/releases/standalone-v8.1.1.md)
- 独立仓库迁移清单：[`docs/standalone-project-migration-checklist.md`](docs/standalone-project-migration-checklist.md)

## 快速开始

### 环境要求

- Chrome 或 Chrome for Testing
- 打开扩展开发者模式
- 可用的 OAuth 来源配置（如 SUB2API / Codex2API / 其他本地适配链路）
- 至少一条可用收码链路：
  - Hotmail007 / Hotmail
  - 2925 / LuckMail / 自定义邮箱
  - HeroSMS / 5sim / NexSMS 等手机接码 provider

### 安装扩展

1. 打开 `chrome://extensions/`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择仓库目录 `E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007`
5. 打开扩展侧边栏开始配置

### 导入现有配置

如果你已经有历史配置文件：

1. 打开扩展侧边栏
2. 进入配置导入入口
3. 选择你之前导出的 JSON 配置
4. 导入后检查：
   - Hotmail007 / Hotmail 账号池
   - 接码 provider key
   - 自动运行策略
   - 记账与账号记录相关开关

更完整的面向使用者说明见：

- [`docs/安装与配置指南.md`](docs/%E5%AE%89%E8%A3%85%E4%B8%8E%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md)

### 最小验证顺序

建议先不要直接全自动跑大批量，先做一次最小链路验证：

1. 检查邮箱/接码 provider 配置是否可用
2. 手动跑通关键步骤
3. 确认验证码链路与回调链路正常
4. 再启用多轮 Auto

## 开发与测试

常用命令：

```powershell
npm test
```

如果只验证核心恢复链路，可优先跑：

```powershell
node --test tests/phone-verification-flow.test.js
node --test tests/signup-page-verification-error-state.test.js
node --test tests/background-free-reusable-phone-country.test.js
```

如果你在做独立版文档或发布整理，发布前至少确认：

1. `manifest.version` 与 `manifest.version_name` 已同步更新
2. `README.md` 与 `docs/独立版发布说明.md` 已同步
3. 没有把 `.debug/`、临时脚本、监控日志误提交到远端

## 仓库主要目录

```txt
background.js                              后台主控
background/                                自动运行、接码恢复、记账相关后台模块
content/                                   ChatGPT / 邮箱 / 面板页面脚本
sidepanel/                                 侧边栏 UI 与配置逻辑
tests/                                     自动化测试
data/                                      静态数据
docs/独立版发布说明.md                    独立版发布口径
docs/standalone-project-migration-checklist.md  独立仓库迁移记录
README.history.md                          历史来源说明
```

## 当前文档入口

- 主说明：[`README.md`](README.md)
- 历史来源：[`README.history.md`](README.history.md)
- 独立版发布说明：[`docs/独立版发布说明.md`](docs/%E7%8B%AC%E7%AB%8B%E7%89%88%E5%8F%91%E5%B8%83%E8%AF%B4%E6%98%8E.md)
- 安装与配置指南：[`docs/安装与配置指南.md`](docs/%E5%AE%89%E8%A3%85%E4%B8%8E%E9%85%8D%E7%BD%AE%E6%8C%87%E5%8D%97.md)
- 当前独立版 Release Notes：[`docs/releases/standalone-v8.1.md`](docs/releases/standalone-v8.1.md)
- 独立仓库迁移清单：[`docs/standalone-project-migration-checklist.md`](docs/standalone-project-migration-checklist.md)

## 许可证

本项目延续上游许可证：

- License: `Apache-2.0`

同时保留上游来源说明与必要历史文档，但当前独立仓库是唯一正式维护入口。
