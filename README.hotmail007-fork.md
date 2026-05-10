# Hotmail007 Fork README

## 历史来源

本项目最初基于上游仓库进行定制开发，后续迁移为独立仓库持续维护。

- 独立仓库：[`pkeran/codex-oauth-automation-extension-hotmail007`](https://github.com/pkeran/codex-oauth-automation-extension-hotmail007)
- 历史 fork 仓库：[`pkeran/codex-oauth-automation-extension`](https://github.com/pkeran/codex-oauth-automation-extension)
- 历史主分支：`dev-hotmail007`
- 当前独立仓库默认分支：`main`

## 当前角色

这个文件现在只承担两件事：

- 记录 Hotmail007 改版最早来自哪个 fork 背景
- 给仍在使用旧 fork 仓库的人一个清晰迁移入口

当前应优先参考独立仓库中的 `main` 分支与主 README，而不是继续把 fork README 当成主入口。

## Overview

This branch is a maintained fork of the upstream project:

- Upstream: `QLHazyCoder/codex-oauth-automation-extension`
- Fork owner: `pkeran`
- Fork repo: `pkeran/codex-oauth-automation-extension`

This fork keeps the original repository name, but carries local Hotmail007-oriented changes, recovery logic, phone verification improvements, cost ledger features, and sidepanel refinements.

## Current fork release

- Extension version: `8.1`
- Extension version name: `8.1`
- Recommended remote branch: `dev-hotmail007`

## Main fork-specific changes

- Hotmail007 account pool integration
- Long-lived mailbox export support
- Phone verification provider strategy enhancements
- Step 3 / Step 4 / Step 7 / Step 8 recovery hardening
- Free reusable phone activation handling
- Cost ledger and account history extensions
- Sidepanel workflow and configuration refinements

## Branching notes

- Upstream-compatible history is preserved in the fork repository
- Fork-specific work is intended to live on dedicated branches instead of overwriting upstream branch names directly
- Recommended working branch for this fork line: `dev-hotmail007`

## Local development

Repository path used for this fork:

```txt
E:\ECS\C202604291913907\codex-oauth-automation-extension-hotmail007
```

Run tests:

```powershell
npm test
```

## Packaging note

The extension manifest currently uses:

```json
{
  "version": "8.1",
  "version_name": "8.1"
}
```

If later fork releases continue independently from upstream, this file should be updated first before publishing.
