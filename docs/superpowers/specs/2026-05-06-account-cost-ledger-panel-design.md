# 账号记录面板与记账面板独立化设计

- 日期：2026-05-06
- 目标仓库：`E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007`
- 范围：`sidepanel` 前端 UI、交互、测试

## 1. 背景

当前侧边栏只有一个“账号记录”弹层，同时承载两类职责：

1. 运行记录浏览
   - 账号状态
   - 失败原因
   - 重试次数
   - 分页、多选、删除
2. 成本统计与账本
   - 成功总成本
   - 成功平均成本
   - 全部消耗总成本
   - 成功摊销平均成本
   - 按天账本
   - 清理账本

这两类信息面向的是不同任务：

- 记录面板：用于排障、复盘、定位失败轮次
- 记账面板：用于成本统计、日维度核算、账本维护

当前混在一个 overlay 内，会造成职责混杂、空间竞争和操作语义不清。

## 2. 已确认需求

1. 记账面板必须从记录面板中独立出来
2. 记账面板入口放在配置菜单，不放在日志区
3. 记录面板继续保留单条记录的成本明细
4. 记账面板负责汇总成本、按天账本和账本清理
5. 不改后端账本模型，只做前端结构重组

## 3. 目标与非目标

### 3.1 目标

- 将“记录浏览”和“成本核算”拆成两个独立 UI 面板
- 保持现有 `accountRunHistory` 与 `accountCostLedger` 数据模型不变
- 降低单个 manager 的职责复杂度
- 让后续“导出账本 / 币种汇总 / 日期过滤”有清晰扩展位

### 3.2 非目标

- 不修改 `background.js` 中账本持久化结构
- 不修改记录条目的成本写入逻辑
- 本轮不引入新的统计口径
- 本轮不新增后端接口

## 4. 方案选择

采用 **双面板、双入口、双 manager** 方案。

### 4.1 记录面板

- 入口：日志区按钮 `记录`
- 保留 overlay 弹层形态
- 只负责运行记录相关操作

### 4.2 记账面板

- 入口：配置菜单中的独立按钮
- 使用单独 overlay 弹层
- 只负责账本汇总、按天统计与账本清理

这是最符合现有代码结构和用户认知的方案，因为：

- 记录属于高频查看项，保留快捷入口合理
- 记账属于低频但信息密度高的统计视图，放到配置菜单更合理
- 两类数据虽然有关联，但不应强制在同一面板内消费

## 5. UI 结构设计

### 5.1 日志区

保持现状：

- `记录` 按钮保留
- 不新增 `记账` 快捷按钮

### 5.2 配置菜单

新增一个菜单项：

- 文案建议：`记账`
- 推荐 DOM id：`btn-open-account-cost-ledger`

该按钮点击后打开独立记账面板。

### 5.3 记录面板保留内容

记录面板中保留：

- 标题与 meta
- 记录状态筛选 chips
  - 全部
  - 成功
  - 失败
  - 停止
  - 重试
- 多选模式
- 删除选中
- 清理记录
- 记录列表
- 分页
- 单条记录成本明细
  - 总成本
  - 邮箱成本
  - 手机成本

### 5.4 记录面板移除内容

从记录面板移除：

- 成功总成本
- 成功平均成本
- 全部消耗总成本
- 成功摊销平均成本
- 按天账本列表
- 清理账本按钮

### 5.5 记账面板内容

记账面板只展示：

- 标题与 meta
- 汇总统计卡片
  - 成功数
  - 成功总成本
  - 成功平均成本
  - 全部消耗总成本
  - 成功摊销平均成本
- 按天账本列表
  - 日期
  - 当天成功数
  - 当天成功总成本
  - 当天全部消耗总成本
  - 当天成功摊销平均成本
- 清理账本按钮

记账面板不展示：

- 运行记录列表
- 记录状态筛选
- 多选删除记录

## 6. 前端模块拆分设计

### 6.1 保留并瘦身 `account-records-manager.js`

文件：

- `sidepanel/account-records-manager.js`

保留职责：

- 读取并排序 `accountRunHistory`
- 记录筛选
- 记录分页
- 多选删除
- 清理记录
- 单条记录成本展示
- 记录面板打开/关闭

移除职责：

- 汇总成本 chips
- 按天账本渲染
- 清理账本

### 6.2 新增 `account-cost-ledger-manager.js`

新增文件：

- `sidepanel/account-cost-ledger-manager.js`

负责：

- 读取 `accountRunHistory` 与 `accountCostLedger`
- 汇总成功成本
- 汇总账本消耗
- 按天聚合
- 渲染记账面板
- 清理账本
- 记账面板打开/关闭

### 6.3 共享计算函数

以下函数不应复制粘贴到两个 manager 中：

- `normalizeCostAmount`
- `formatCostAmount`
- `formatCurrencySummary`
- `summarizeSuccessCosts`
- `summarizeLedgerCosts`
- `summarizeDailyCosts`

推荐做法：

1. 先抽到共享 util，例如 `sidepanel/account-cost-utils.js`
2. `account-records-manager.js` 与 `account-cost-ledger-manager.js` 共同使用

如果本轮想控制 patch 范围，也可以先只把真正需要共享的格式化函数抽出，其余在第二轮继续整理。

## 7. HTML / CSS 改动范围

### 7.1 `sidepanel.html`

需要新增：

- 配置菜单项：`btn-open-account-cost-ledger`
- 新 overlay：`account-cost-ledger-overlay`
- 新 panel 根节点与内部容器，例如：
  - `account-cost-ledger-meta`
  - `account-cost-ledger-summary`
  - `account-cost-ledger-daily-list`
  - `btn-clear-account-cost-ledger`
  - `btn-close-account-cost-ledger`

需要调整：

- 从 `account-records-overlay` 中移除：
  - `account-records-daily-costs`
  - `btn-clear-account-cost-ledger`

### 7.2 `sidepanel.css`

需要新增一套 `account-cost-ledger-*` 样式。

建议不要复用 `account-records-*` 命名，避免后续维护混乱。

可以保留一部分共通样式结构，但 class name 需要明确分域。

## 8. `sidepanel.js` 集成方式

当前 `sidepanel.js` 已初始化记录 manager。

本轮新增：

- 记账面板 DOM 获取
- 记账 manager 初始化
- 配置菜单入口事件绑定
- 在 `DATA_UPDATED` 或 `latestState` 更新后，同时触发：
  - `renderAccountRecords()`
  - `renderAccountCostLedger()`

要求：

- 两个 manager 共享同一个 `latestState`
- 两个 manager 不互相直接调用
- 统一由 `sidepanel.js` 负责组装上下文

## 9. 数据与行为约束

### 9.1 数据源

保持不变：

- 记录源：`accountRunHistory`
- 账本源：`accountCostLedger`

### 9.2 清理行为

- 清理记录：只影响 `accountRunHistory`
- 清理账本：只影响 `accountCostLedger`

### 9.3 保留行为

记录面板中的单条记录仍按当前口径显示成本，不迁移、不变更、不隐藏。

## 10. 测试设计

### 10.1 需要修改的现有测试

- `tests/sidepanel-account-records-manager.test.js`
- `tests/sidepanel-account-cost-daily.test.js`

### 10.2 记录面板测试新口径

记录面板测试应断言：

- 仍有 `btn-open-account-records`
- 仍有 `account-records-overlay`
- 有记录列表
- 有筛选、多选、删除、清理记录
- 单条记录成本明细继续存在
- **不再要求**
  - `account-records-daily-costs`
  - `btn-clear-account-cost-ledger`
  - 账本汇总 chip

### 10.3 记账面板测试新口径

记账面板测试应断言：

- 配置菜单内存在 `btn-open-account-cost-ledger`
- 有独立 `account-cost-ledger-overlay`
- 能渲染按天账本
- 能独立清理账本
- 清账后不影响 `accountRunHistory`

## 11. 最小实现顺序

建议按以下顺序推进：

1. 补前端失败测试
   - 记录面板不再包含账本区
   - 记账面板独立存在
   - 清理账本只在记账面板触发
2. 跑红灯
3. 拆 HTML
4. 新增 ledger manager
5. 瘦身 records manager
6. 接入 `sidepanel.js`
7. 跑 targeted tests
8. 跑 `npm test`
9. bump 版本号

## 12. 风险与缓解

### 风险 1：共享成本函数复制扩散

缓解：

- 抽共享 util
- 至少先抽格式化和汇总函数

### 风险 2：测试大量绑定旧 DOM

缓解：

- 先改测试口径
- 再做 HTML 重组

### 风险 3：配置菜单入口与现有菜单交互冲突

缓解：

- 复用现有菜单按钮样式与事件模型
- 仅新增一个独立 action，不重构整个菜单

## 13. 验收标准

满足以下条件视为完成：

1. 记录面板与记账面板是两个独立 overlay
2. 记账面板只能从配置菜单进入
3. 记录面板仍能看到单条记录成本明细
4. 记录面板不再包含按天账本与清理账本
5. 清理账本不会清除记录
6. 全量测试通过

