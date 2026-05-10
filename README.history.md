# 项目历史来源说明

## 1. 来源关系

- 上游来源：`QLHazyCoder/codex-oauth-automation-extension`
- 历史中间态：曾以 `pkeran/codex-oauth-automation-extension` fork 仓库承载 Hotmail007 改版线
- 当前正式仓库：[`pkeran/codex-oauth-automation-extension-hotmail007`](https://github.com/pkeran/codex-oauth-automation-extension-hotmail007)

## 2. 迁移结论

当前项目已经完成从“fork 定制线”到“独立项目主线”的迁移：

- 对外唯一维护入口：独立仓库 `main`
- 本地持续开发分支：`dev`
- 历史 fork 主分支标识：`dev-hotmail007`

也就是说，旧 fork 只代表一段迁移历史，不再承担发布入口职责。

当前应优先查看：

- 主 README：[`README.md`](README.md)
- 独立版发布说明：[`docs/独立版发布说明.md`](docs/%E7%8B%AC%E7%AB%8B%E7%89%88%E5%8F%91%E5%B8%83%E8%AF%B4%E6%98%8E.md)

## 3. 当前独立版关注点

当前独立版主要维护这些能力：

- Hotmail007 账号池与长效邮箱导出
- 手机号接码 provider 策略、恢复分流与复用控制
- Step 2 / 3 / 4 / 7 / 8 / 9 自动恢复与结构化错误分流
- 成本账本、注册记录、按天持久化与导出
- 侧边栏配置收敛、独立记账入口与调试辅助

## 4. 本地开发参考

本地仓库路径：

```txt
E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007
```

常用验证命令：

```powershell
npm test
```

## 5. 版本口径

当前扩展版本：

```json
{
  "version": "8.1",
  "version_name": "8.1"
}
```

后续版本应按独立项目口径递增维护，而不是继续沿用 fork 叙事。
