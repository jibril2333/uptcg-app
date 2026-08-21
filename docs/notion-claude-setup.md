# Notion 看板 → Claude → Pull Request

在 Notion 任务卡片的评论里写 `@claude ...`，Claude Code 会在 GitHub 托管 runner 上
开分支实现、跑 `npm run lint` 和 `npm test`、创建 PR，并把 PR 链接写回卡片评论。
Claude 任务不得合并 PR、不得部署、不得同步生产卡牌数据。

这条链路是 [linear-codex-setup.md](./linear-codex-setup.md) 的 Notion 版本，
面向 **Notion 免费版**：不使用 Notion 的付费自动化功能。

## 架构

```text
Notion 卡片评论 "@claude 请实现 ..."
        │  轮询（默认 30 秒，Mac mini 上的 launchd 常驻进程）
        ▼
scripts/notion-claude-watcher.mjs
        │  1. 查 📝 Tasks 数据库里最近编辑的卡片
        │  2. 读卡片评论和正文，找没处理过的 @claude
        │  3. POST /repos/{owner}/{repo}/dispatches
        │  4. 回卡片一条「已接单」评论
        ▼
.github/workflows/notion-claude.yml   (repository_dispatch, ubuntu-latest)
        │  anthropics/claude-code-action@v1 + CLAUDE_CODE_OAUTH_TOKEN
        │  按 AGENTS.md 开分支 → lint/test → gh pr create
        ▼
scripts/notion-claude-report.mjs      回写 PR 链接到卡片评论
        ▼
人工审核 → 合并到 main → 触发既有生产部署
```

### 为什么是轮询而不是 webhook

Notion 数据库自动化里的 **Send webhook 动作是付费版（Plus 及以上）功能**，免费版
用不了。Notion REST API 自 `2026-03-01` 版本起提供了整合层面的 webhook 订阅
（`/v1/webhooks`，公测中），但需要一个公网 HTTPS 端点来接收回调。

30 秒轮询在体感上等同实时，不需要公网端点，也不需要付费。等 API webhook 稳定
且确认你的工作区可用之后，可以只替换 watcher 的「发现触发」部分，
`repository_dispatch` 之后的链路完全不用改。

## 一、创建 Notion 内部整合

内部整合在所有 Notion 套餐（含免费版）都可用。

1. 打开 <https://www.notion.so/profile/integrations>，`New integration`。
2. 名称填 `UPTCG Claude Watcher`，关联到你的工作区。
3. Capabilities 勾选：
   - Read content
   - Read comments
   - Insert comments

   不要勾 Update content 和 Insert content —— 这条链路不需要改卡片属性或正文。
4. 复制 Internal Integration Secret（`ntn_...`），后面作为 `NOTION_TOKEN`。
5. 回到 Notion，打开 `📝 Tasks` 数据库 → 右上角 `...` → `Connections` →
   添加 `UPTCG Claude Watcher`。不加这一步，整合读不到任何数据。

### 确认数据库 ID

`📝 Tasks` 数据库当前 ID 是 `2599ace6-0c51-8064-816c-d757f04287d6`
（watcher 的默认值）。如果以后换库，用 Notion 里的 `Copy link to view`
拿到的 URL：`notion.so/<workspace>/<32位十六进制>?v=...`，那 32 位就是数据库 ID。

## 二、GitHub 配置

### PAT

建一个 fine-grained personal access token，Repository access 只选 `jibril2333/uptcg-app`，
Repository permissions：

- `Contents`: Read and write（推分支）
- `Pull requests`: Read and write（建 PR）
- `Metadata`: Read（自动带上）

用 PAT 而不是 `GITHUB_TOKEN` 有两个原因：Mac 上的 watcher 要在仓库外调
`repository_dispatch`；用默认 `GITHUB_TOKEN` 推的提交不会触发
`Pull request checks`，PR 会一直没有 CI 结果。

同一个 PAT 值同时用在 Mac 的环境变量和仓库 Secret 里即可。

### Claude 订阅 token

在本机运行 `claude setup-token`，得到一个 OAuth token。它走你现有的
Claude Pro/Max 订阅额度，不需要单独的 Anthropic API key、不按 API 计费。

### 仓库 Secrets

在 Settings → Secrets and variables → Actions 添加：

| Secret | 值 |
| --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` 的输出 |
| `CLAUDE_TASK_GITHUB_TOKEN` | 上面的 fine-grained PAT |
| `NOTION_TOKEN` | Notion 整合的 `ntn_...` |

### 分支保护

沿用 `linear-codex-setup.md` 里的设置：`main` 要求 PR、要求
`Pull request checks / test` 通过、保留人工审核。Claude 只会创建 PR，不会合并。

> `repository_dispatch` 工作流只会从**默认分支**读取。
> `.github/workflows/notion-claude.yml` 必须先合并到 `main` 才会被触发。

## 三、在 Mac mini 上跑 watcher

watcher 只读 Notion、写 Notion 评论、调 GitHub dispatch API。它不构建、不部署，
也不接触 `/Users/rei/Library/Application Support/UPTCG/data`。

先手动验证一次：

```bash
cd /path/to/uptcg-app
export NOTION_TOKEN='ntn_...'
export GITHUB_DISPATCH_TOKEN='github_pat_...'
npm run notion:watch -- --once --dry-run
```

`--dry-run` 只打印会发生什么，不触发 GitHub、不写评论。确认输出里能看到你的卡片
之后，去掉 `--dry-run` 再跑一次 `--once` 做真实验证。

### 常驻

把密钥写进一个只有自己可读的文件：

```bash
mkdir -p ~/.config/uptcg
cat > ~/.config/uptcg/notion-claude.env <<'EOF'
NOTION_TOKEN=ntn_...
GITHUB_DISPATCH_TOKEN=github_pat_...
EOF
chmod 600 ~/.config/uptcg/notion-claude.env
```

包装脚本 `~/.config/uptcg/notion-claude.sh`：

```bash
#!/bin/bash
set -euo pipefail
set -a
source "$HOME/.config/uptcg/notion-claude.env"
set +a
export PATH="/opt/homebrew/bin:$PATH"
cd "$HOME/path/to/uptcg-app"
exec node scripts/notion-claude-watcher.mjs
```

`chmod +x` 之后，`~/Library/LaunchAgents/com.uptcg.notion-claude-watcher.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.uptcg.notion-claude-watcher</string>
  <key>ProgramArguments</key>
  <array><string>/Users/rei/.config/uptcg/notion-claude.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/rei/Library/Logs/uptcg-notion-claude.log</string>
  <key>StandardErrorPath</key><string>/Users/rei/Library/Logs/uptcg-notion-claude.log</string>
</dict>
</plist>
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.uptcg.notion-claude-watcher.plist
tail -f ~/Library/Logs/uptcg-notion-claude.log
```

### 可调环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NOTION_TOKEN` | 必填 | Notion 内部整合密钥 |
| `GITHUB_DISPATCH_TOKEN` | 必填 | 触发 `repository_dispatch` 的 PAT |
| `GITHUB_REPOSITORY` | `jibril2333/uptcg-app` | 目标仓库 |
| `NOTION_TASKS_DATABASE_ID` | `2599ace6-0c51-8064-816c-d757f04287d6` | 看板数据库 |
| `NOTION_MENTION` | `@claude` | 触发词 |
| `POLL_INTERVAL_SECONDS` | `30` | 轮询间隔 |
| `NOTION_LOOKBACK_HOURS` | `24` | 只看这段时间内编辑过的卡片 |
| `NOTION_SCAN_PAGE_BODY` | `true` | 是否也扫描卡片标题和正文里的触发词 |
| `NOTION_WATCHER_STATE` | `~/.local/state/uptcg/notion-claude-watcher.json` | 去重状态文件 |

## 四、日常用法

在 `📝 Tasks` 的卡片里加一条评论：

```text
@claude 卡表页面的筛选器在移动端会溢出屏幕，请修掉并加一个回归测试。
```

然后：

1. 30 秒内 watcher 会在卡片下回一条 `🤖 已交给 Claude 处理` 并附上分支名。
2. Claude 在 `claude/notion-<卡片ID前8位>-<时间戳>` 分支上实现并创建 PR。
3. 完成后卡片里再出现一条评论，带 PR 链接和运行日志链接。
4. 你审 PR、合并；合并到 `main` 会触发本机生产部署，所以合并即代表批准部署。

卡片正文写得越接近 [linear-issue-template.md](./linear-issue-template.md)
的结构（目标 / 范围 / 验收标准），结果越准。评论里那句话本身也会作为
「触发请求」传给 Claude，可以只在评论里补充这次要做的具体范围。

### 行为细节

- 一张卡片一次只派一单，用最新的那条 `@claude` 评论。
- 已处理过的评论 ID 记录在状态文件里，重启 watcher 不会重复派单。
- watcher 自己发的 `🤖` 开头的评论会被跳过，不会自触发。
- Status 是 `Done` 或 `Canceled` 的卡片直接忽略。
- 这个库里生活类卡片和开发卡片混在一起。只有你主动 `@claude` 的卡片会被处理；
  如果误触发到非代码任务，工作流里的提示要求 Claude 不改代码、直接说明原因。

## 五、安全边界

- 工作流固定 `runs-on: ubuntu-latest`。**不要**改成自托管的 `uptcg` runner，
  那台机器上有生产数据和部署脚本。
- 工作流只有 `contents: read` 权限；推分支和建 PR 走 PAT，权限范围限定在本仓库。
- 卡片内容在提示里包在 `<NOTION_TASK>` 块内，并明确声明为数据而非指令。
- watcher 的 Notion 整合没有写内容权限，最多只能发评论。
- Claude 不合并、不部署、不跑生产同步；这些都写在 `AGENTS.md` 和工作流提示里。

## 六、首次验收

- [ ] Notion 整合已创建，只有 Read content / Read comments / Insert comments
- [ ] `📝 Tasks` 数据库已 Connections 到该整合
- [ ] `npm run notion:watch -- --once --dry-run` 能列出卡片且无报错
- [ ] 三个仓库 Secret 已配置
- [ ] `.github/workflows/notion-claude.yml` 已合并进 `main`
- [ ] launchd 已加载，日志正常滚动
- [ ] 用一张低风险测试卡片验证：接单评论 → PR → 回报评论
- [ ] PR 上 `Pull request checks / test` 有运行（说明 PAT 生效）
- [ ] Claude 只建了 PR，没有合并、没有部署、没有跑生产同步
