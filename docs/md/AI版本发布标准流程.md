# AI 版本发布标准流程

## 用途

本文用于给 AI 一个固定、完整、可重复执行的版本发布流程。

当前标准版本系列固定为 `Ultra`。从本文生效开始，所有新的正式发布都必须使用 `UltraX.Y` 格式；历史 `ProX.Y` 与 `vX.Y.Z` 版本只用于兼容读取、更新检查和差异分析，不能再作为默认发布目标。

当用户在本仓库中引用本文，并明确说出类似下面的话时：

- `更新版本到 Ultra1.0`
- `更新版本到 1.0`
- `继续发 3.3 版本`
- `按本文发布 Ultra1.0`
- `引用这个文件，把版本更新到 Ultra1.0 并发版`

AI 必须按本文执行，不能猜流程，不能跳步骤，不能只做一半。

## 目标

AI 在收到“更新版本到 UltraX.Y”或可无歧义标准化的口语化版本号后，必须完成下面两段流程。

1. 发布前流程：修改 `manifest.json` 的版本字段；提交本次准备发布的代码；基于“上一个 GitHub Release 到当前 HEAD”的真实差异分析更新内容；在需要用户确认的场景下，把发布文案先返回给用户看，且必须放在代码块里。
2. 发布流程：把最终确认过的文案作为 GitHub Release 正文发布；发布前必须把 `master` 与 `dev` 都推送到本次待发布的最新提交；发布完成后，再次从 GitHub 线上读取正文；审查正文是否乱码、是否异常、是否与最终发布稿一致。如果有问题，必须立刻修正后再汇报完成。

## 仓库硬性规则

1. 任何结论都不能猜，必须基于真实命令输出、真实 diff、真实 GitHub 返回结果。
2. GitHub Releases 是版本发布真相源。分析“距离上一个版本更新了什么”时，默认以上一个正式 Release 为起点。
3. 不要先检查 `gh` 是否存在、是否登录、是否在 PATH、是否可用，也不要先跑 `gh auth status`。直接使用固定路径命令执行。
4. `gh` 固定路径使用：

```powershell
$GH = 'C:\Program Files\GitHub CLI\gh.exe'
if (-not (Test-Path $GH)) {
  throw 'gh.exe fixed path not found: C:\Program Files\GitHub CLI\gh.exe'
}
```

5. 默认 GitHub 仓库固定为：

```powershell
$Repo = 'QLHazyCoder/codex-oauth-automation-extension'
```

6. 默认不编译、不跑全量测试。完成后提醒用户自行测试；如果本次变更触及版本解析、更新服务或关键逻辑，应至少运行对应的聚焦测试。
7. 如果当前工作区里存在无法确认是否属于本次发布的改动，必须先停下来问用户，不能猜哪些该一起发、哪些不该一起发。
8. 发布完成后，必须做一次“线上正文复检”，确认不是乱码，不是空正文，不是错误版本，不是错误标签。
9. 新标准使用 `Ultra` 作为对外版本前缀，数字部分必须使用严格的 `x.x`。
10. `manifest.json` 中需要同时维护：
    - `version`：只保存数字部分，例如 `1.0`
    - `version_name`：保存完整显示版本，例如 `Ultra1.0`
11. 仓库可能存在历史 `ProX.Y` 和 `vX.Y.Z` Release。历史版本只用于兼容读取和差异分析，不阻止首个 `Ultra1.0` 发布。
12. 如果用户输入 `ProX.Y`，必须提示当前发布标准已切换到 `UltraX.Y`，不能直接创建新的 `Pro` Release；除非用户明确要求维护历史 Pro 系列，并同步修改本文流程，否则一律按 Ultra 系列处理。

## 输入要求

AI 至少要从用户输入中拿到下面这些信息：

- 目标完整版本号，例如 `Ultra1.0`，或可标准化为它的口语化版本号
- 是否已经确认可以发布
- 如果用户有特别强调的更新点，也要纳入发布文案

如果用户没有给版本号，就不能猜。

如果用户说的是口语化版本号，但可以被无歧义标准化，AI 必须直接标准化，不要再反问版本号。例如：

- `1` -> `Ultra1.0`
- `1.0` -> `Ultra1.0`
- `Ultra1` -> `Ultra1.0`
- `3.3` -> `Ultra3.3`

只有在用户给出的版本号无法无歧义转换为标准完整版本号时，才允许追问。

如果用户明确使用了“发布 / 发版 / 继续发 / 直接发布 / 不要再问我 / 按标准直接发”等表达，视为已经确认可以发布，AI 不需要再额外等待一次口头确认；后续所有命令、提交、tag、Release 标题、Release 正文都必须统一使用完整版本号 `UltraX.Y`，不能继续混用口语化写法。

如果用户明确要求“文案写好之后我要确认”，则无论用户是否说了发布，都必须在创建 GitHub Release 前停止，把发布文案草稿返回给用户确认。

## 固定变量模板

每次执行本文时，先统一使用下面这组变量：

```powershell
$GH = 'C:\Program Files\GitHub CLI\gh.exe'
if (-not (Test-Path $GH)) {
  throw 'gh.exe fixed path not found: C:\Program Files\GitHub CLI\gh.exe'
}

$Repo = 'QLHazyCoder/codex-oauth-automation-extension'
$ReleaseSeries = 'Ultra'
$TargetVersionCore = '<用户输入并标准化后的数字版本号，必须使用 x.x，例如：1.0>'
$TargetVersionName = "$ReleaseSeries$TargetVersionCore"
$TargetTag = $TargetVersionName
$ManifestPath = 'manifest.json'
```

## 阶段 1：发布前检查

### 1. 真实查看当前工作区

先执行：

```powershell
git status --short --branch
git remote -v
```

要求：

1. 必须看清当前分支和当前未提交改动。
2. 如果工作区中有改动，必须结合 diff 判断这些改动是不是本次要发布的真实内容。
3. 如果有无法确认归属的改动，必须先问用户，不准猜。

### 2. 读取当前版本号

执行：

```powershell
$Manifest = Get-Content -Path $ManifestPath -Raw | ConvertFrom-Json
$CurrentVersionCore = [string]$Manifest.version
$CurrentVersionName = [string]$Manifest.version_name
$CurrentVersionLabel = if ($CurrentVersionName) { $CurrentVersionName } else { "v$CurrentVersionCore" }
$CurrentVersionCore
$CurrentVersionLabel
```

要求：

1. 当前版本必须从 `manifest.json` 真实读取。
2. 新标准下，`version` 只保存数字部分 `x.x`，`version_name` 保存完整版本 `UltraX.Y`。
3. 如果当前已经是 `Ultra` 系列，则目标数字版本必须大于当前数字版本，不能相等，不能更小。
4. 如果当前还是历史 `Pro` 或 `v` 系列，而目标是首个 `Ultra` 系列版本，则允许从 `Ultra1.0` 重新起算，但必须明确记录这是命名体系切换。

示例校验：

```powershell
$IsCurrentUltraSeries = $CurrentVersionName -match '^Ultra\d+\.\d+$'
if ($IsCurrentUltraSeries -and ([version]$TargetVersionCore -le [version]$CurrentVersionCore)) {
  throw "Target version $TargetVersionCore must be greater than current Ultra version $CurrentVersionCore"
}
```

### 3. 检查目标版本是否已经存在

先查 GitHub Releases：

```powershell
$Releases = & $GH api "repos/$Repo/releases?per_page=100" | ConvertFrom-Json
$ExistingReleaseTag = ($Releases | Where-Object { $_.tag_name -eq $TargetTag } | Select-Object -First 1 -ExpandProperty tag_name)
```

再查本地 tag：

```powershell
$ExistingLocalTag = ([string](git tag --list $TargetTag)).Trim()
```

再查最新一个正式 `Ultra` Release：

```powershell
$LatestUltraReleaseTag = ($Releases |
  Where-Object { -not $_.draft -and -not $_.prerelease -and $_.tag_name -match '^Ultra[0-9]+\.[0-9]+$' } |
  Select-Object -First 1 -ExpandProperty tag_name)
$LatestUltraReleaseVersionCore = if ($LatestUltraReleaseTag) { $LatestUltraReleaseTag.Substring(5) } else { '' }
```

规则：

1. 只要 GitHub Release 已存在这个 tag，就必须停止，不能重复发版。
2. 如果本地 tag 已存在，但 GitHub Release 不存在，也必须停止并告知用户先确认历史状态，不能直接覆盖。
3. 如果已经存在最新正式 `Ultra` Release，目标数字版本还必须大于这个正式 `Ultra` Release 的数字版本，不能倒发版。
4. 如果仓库里还没有任何 `Ultra` Release，允许从 `Ultra1.0` 开始，即使仓库里存在历史 `ProX.Y` 或 `vX.Y.Z` Release。

示例校验：

```powershell
if ($LatestUltraReleaseVersionCore -and ([version]$TargetVersionCore -le [version]$LatestUltraReleaseVersionCore)) {
  throw "Target version $TargetVersionCore must be greater than latest Ultra released version $LatestUltraReleaseVersionCore"
}
```

## 阶段 2：更新版本号并提交

### 1. 修改 `manifest.json`

AI 必须把 `manifest.json` 中的下面两个字段同步更新为目标版本：

- `version = x.x`
- `version_name = UltraX.Y`

### 2. 检查变更内容

执行：

```powershell
git diff --stat
git diff -- manifest.json
```

如果工作区里还有其他变更，也要继续真实查看它们的 diff，确认是否属于本次发布内容。

### 3. 提交本次发布

规则：

1. 如果当前工作区改动就是本次要发布的功能改动，就应与版本号一起提交。
2. 如果存在来源不明或明显无关的改动，必须先停下来问用户，不能偷偷一起提交，也不能擅自丢掉。
3. 提交信息统一使用：

```text
chore(release): bump version to UltraX.Y
```

示例：

```powershell
git add -A
git commit -m "chore(release): bump version to $TargetTag"
```

提交后，必须记录真实提交哈希：

```powershell
git rev-parse HEAD
```

## 阶段 3：分析“距离上一个版本更新了什么”

### 1. 获取上一个正式 Release

执行：

```powershell
$PreviousReleaseTag = ($Releases |
  Where-Object { -not $_.draft -and -not $_.prerelease } |
  Select-Object -First 1 -ExpandProperty tag_name)
$PreviousReleaseTag
```

规则：

1. 默认取最新一个正式 Release 作为“上一个版本”。
2. 如果仓库还没有任何正式 Release，再退回到本地最新 tag：

```powershell
if (-not $PreviousReleaseTag) {
  $PreviousReleaseTag = ([string](git tag --sort=-creatordate | Select-Object -First 1)).Trim()
}
```

3. 如果仍然拿不到上一个版本，就按“首个版本发布”处理，并明确告诉用户这是首发版本文案。

### 2. 拉真实变更范围

如果存在上一个版本，执行：

```powershell
git log --oneline "$PreviousReleaseTag"..HEAD
git diff --stat "$PreviousReleaseTag"..HEAD
git diff --name-only "$PreviousReleaseTag"..HEAD
```

然后根据变更文件继续往下读真实 diff，不能只看 commit 标题。

必要时继续执行：

```powershell
git diff "$PreviousReleaseTag"..HEAD -- <具体文件路径>
```

### 3. 文案分析要求

AI 必须基于真实 diff 和真实代码上下文，分析并提炼：

- 新增了什么功能
- 修复了什么问题
- 优化了什么逻辑
- 删除了什么无用或陈旧逻辑
- 哪些点最值得放进发布说明

禁止行为：

- 只看 commit message 就编文案
- 把没有真实证据的内容写进发布说明
- 把技术细节胡乱拔高成“重大更新”

## 阶段 4：先给用户看发布文案，不要直接发布

在真正发布前，AI 必须把文案返回给用户确认。

返回给用户时，必须同时说明：

1. `manifest.json` 已改到哪个 `version`
2. `manifest.json` 已改到哪个 `version_name`
3. 是否已经提交
4. 本次提交哈希是什么
5. 上一个版本标签是什么
6. 发布文案草稿是什么

发布文案草稿必须放在代码块中，格式建议如下：

```markdown
## UltraX.Y

### 更新内容
- ...
- ...

### 修复与优化
- ...
- ...
```

注意：

1. 这里必须先停下来等用户确认。
2. 用户没确认前，不准创建 GitHub Release。
3. 如果用户要求改文案，只改文案，不要乱改已经完成的代码与提交，除非用户明确要求。

## 阶段 5：用户确认后再发布 GitHub Release

### 1. 先推送当前提交

发布前先把当前分支 HEAD 推到远端：

```powershell
git push origin HEAD
```

如果本次发布是在 `master` 上完成，还必须确保 `dev` 也同步到这次待发布的最新提交，不能只推 `master` 而让 `dev` 停留在旧版本。推荐顺序：

```powershell
git checkout dev
git merge --ff-only master
git push origin dev
git checkout master
```

如果 `dev` 无法快进到当前发布提交，必须先真实检查差异并处理，不能跳过 `dev` 的同步。

### 2. 把用户确认过的文案写入 UTF-8 文件

不要直接把长正文硬塞进命令参数里，先写入临时文件。

示例：

```powershell
$ReleaseNotesFile = Join-Path $env:TEMP "codex-release-$TargetVersionCore.md"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($ReleaseNotesFile, $ReleaseNotes, $Utf8NoBom)
```

### 3. 创建 Release

执行：

```powershell
& $GH release create $TargetTag `
  --repo $Repo `
  --target HEAD `
  --title $TargetTag `
  --notes-file $ReleaseNotesFile
```

要求：

1. 标题默认使用 `UltraX.Y`。
2. 正文必须使用用户确认过的最终文案。
3. 不要在用户没确认前抢先发布。

## 阶段 6：发布后线上正文复检

Release 创建完成后，必须立刻重新读取线上内容。

执行：

```powershell
& $GH api "repos/$Repo/releases/tags/$TargetTag"
& $GH api "repos/$Repo/releases/tags/$TargetTag" --jq '.html_url'
& $GH api "repos/$Repo/releases/tags/$TargetTag" --jq '.tag_name'
& $GH api "repos/$Repo/releases/tags/$TargetTag" --jq '.name'
& $GH api "repos/$Repo/releases/tags/$TargetTag" --jq '.body'
```

复检重点：

1. 线上 tag 是否真的是目标 tag
2. 线上标题是否真的是目标版本
3. 线上正文是否完整
4. 正文是否与用户确认稿一致
5. 是否存在乱码、异常字符、错误换行、空正文

尤其注意下面这些异常：

- 出现明显乱码字符
- 中文被破坏
- 正文为空
- 版本号不对
- 正文内容被截断

### 如果复检发现异常

必须立刻修复，不准带病汇报完成。

修复示例：

```powershell
& $GH release edit $TargetTag `
  --repo $Repo `
  --title $TargetTag `
  --notes-file $ReleaseNotesFile
```

修复后，再重复执行一次“发布后线上正文复检”，直到线上内容正常为止。

## 用户侧最终反馈要求

AI 完成后，对用户的最终反馈至少要说明：

1. 已把 `manifest.json` 更新到哪个 `version`
2. 已把 `manifest.json` 更新到哪个 `version_name`
3. 是否已经提交，提交哈希是什么
4. 上一个版本是什么
5. 发布文案是否经过用户确认
6. 是否已经创建 GitHub Release
7. 是否已经完成线上正文复检
8. 如果没跑测试，要明确提醒用户自行测试

## 一句话执行要求

当用户引用本文并说“更新版本到 UltraX.Y”或给出可标准化的口语化版本号时，AI 必须按下面顺序执行：

1. 真实检查工作区与当前版本
2. 把口语化版本号标准化成 `UltraX.Y`
3. 真实校验目标版本是否合法且未发布
4. 修改 `manifest.json` 的 `version` 与 `version_name`
5. 提交本次待发布改动
6. 基于上一个正式 Release 到当前 HEAD 的真实差异分析更新内容
7. 如果用户没有明确授权直接发布，或者用户要求先确认文案，就把发布文案放进代码块返回给用户确认
8. 用户确认后，推送当前发布提交，并把 `dev` 同步推送到相同的最新提交
9. 创建 GitHub Release
10. 发布完成后再次读取线上正文并检查是否乱码
11. 如有异常，先修复再汇报

不能跳步骤，不能猜，不能偷懒。
