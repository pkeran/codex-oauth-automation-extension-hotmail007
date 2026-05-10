# Hotmail007 Fork 发布说明

## 1. 项目定位

本分支是基于上游 `QLHazyCoder/codex-oauth-automation-extension` 的定制化 fork，主要用于承载本地持续迭代的 Hotmail007、手机号接码、自动恢复、成本记账与侧边栏管理增强能力。

本 fork 的目标不是替代上游全部发布线，而是：

- 保留上游可继续同步的基础结构
- 独立承载本地业务化修正
- 把多轮自动运行、邮箱池、手机号池、记账与恢复策略做成一条稳定分支

## 2. 仓库与分支

- 上游仓库：`QLHazyCoder/codex-oauth-automation-extension`
- 当前 fork 仓库：`pkeran/codex-oauth-automation-extension`
- 当前推荐分支：`dev-hotmail007`

说明：

- 本 fork 保持仓库名与上游一致，以保留标准 fork 关系
- fork 专用改动优先落在 `dev-hotmail007`
- 不建议直接覆盖 fork 中继承自上游的 `dev`

## 3. 当前 fork 版本

- `manifest.version = 8.1`
- `manifest.version_name = 8.1`

版本口径说明：

- 这里的 `8.1` 不是单纯照搬上游 release tag
- 而是当前 fork 线的独立发布口径
- 后续若继续发布，可在该 fork 线内继续递增维护

## 4. 当前 fork 重点增强方向

### 4.1 Hotmail007 相关

- Hotmail007 账号池接入
- 长效邮箱导出能力
- 采购附加 catalog 元数据持久化
- 账号可用性预检与自动切换

### 4.2 手机号接码与恢复

- HeroSMS / 5sim / NexSMS 多 provider 路由
- provider + phone 粒度的运行态隔离
- add-phone 拒绝分类与换号恢复
- Step 4 / Step 9 手机号失败语义增强
- free reusable / 手动复用 / 自动复用拆分
- HeroSMS 手机号前缀推断国家能力

### 4.3 自动运行稳定性

- Step 2 / Step 3 / Step 7 / Step 8 / Step 9 多阶段恢复
- 结构化错误分流
- never-stop 模式增强
- 超时与阶段卡死自动回卷

### 4.4 邮箱与账号池

- Hotmail / 2925 / LuckMail / iCloud / 自定义邮箱池扩展
- 注册记录与邮箱/手机号身份归并
- 长效邮箱、账号池、导出与持久化支持

### 4.5 成本与账本

- 成本账本与注册记录分离
- 按天成本账本
- 成功/失败成本快照
- 手机号与邮箱成本聚合统计

### 4.6 侧边栏与管理界面

- 接码设置分层折叠与结构收敛
- 独立记账入口
- Hotmail007 长效邮箱导出入口
- 多类运行态与错误态可视化增强

## 5. 为什么保留独立 fork 分支

原因主要有三点：

1. 上游分支会继续变动  
2. 本地已经积累了较多业务化分流与恢复逻辑  
3. 直接覆盖上游同名分支会增加同步与回滚风险

因此，当前更合理的做法是：

- 仓库层面保持标准 GitHub fork 关系
- 分支层面使用 `dev-hotmail007` 承载 fork 定制线

## 6. 与上游同步建议

后续如果要继续参考上游版本，建议按下面流程进行：

1. 先比对上游目标 tag / 分支
2. 只挑选有参考价值的修复点
3. 先补失败测试
4. 跑红灯
5. 最小实现
6. 跑 targeted tests
7. 最后全量 `npm test`

不建议直接整批无差别覆盖，因为本 fork 已经存在大量本地结构化错误语义、运行态字段和面板逻辑扩展。

## 7. 当前使用建议

如果你要在这个 fork 上继续开发，建议默认使用：

- 本地工作分支：`dev`
- 对外发布分支：`dev-hotmail007`

如需额外实验性开发，可再从当前 `dev` 或 `dev-hotmail007` 拉出专题分支。

## 8. 测试建议

常用测试命令：

```powershell
npm test
```

如果只验证核心接码链路，可优先跑：

```powershell
node --test tests/phone-verification-flow.test.js
node --test tests/signup-page-verification-error-state.test.js
node --test tests/background-free-reusable-phone-country.test.js
```

## 9. 当前状态总结

当前 fork 已经具备：

- 独立版本号 `8.1`
- 独立远端发布分支 `dev-hotmail007`
- fork 专用 README
- 中文发布说明

这条分支可以作为后续持续维护 Hotmail007 改版插件的主发布线。
