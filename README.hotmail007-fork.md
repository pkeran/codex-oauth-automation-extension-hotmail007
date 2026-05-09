# Hotmail007 Fork README

## Overview

This branch is a maintained fork of the upstream project:

- Upstream: `QLHazyCoder/codex-oauth-automation-extension`
- Fork owner: `pkeran`
- Fork repo: `pkeran/codex-oauth-automation-extension`

This fork keeps the original repository name, but carries local Hotmail007-oriented changes, recovery logic, phone verification improvements, cost ledger features, and sidepanel refinements.

## Current fork release

- Extension version: `8.0`
- Extension version name: `8.0`
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
  "version": "8.0",
  "version_name": "8.0"
}
```

If later fork releases continue independently from upstream, this file should be updated first before publishing.
