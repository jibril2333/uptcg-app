# Linear → Codex → Pull Request

本项目使用 Linear 管理任务、Codex Cloud 独立开发、GitHub Pull Request
人工审核。Codex 任务不得直接合并、同步生产卡牌数据或部署。

## Codex Cloud Environment

在 Codex Settings → Environments 中创建环境：

- GitHub organization：`jibril2333`
- Repository：`uptcg-app`
- Default branch：`main`
- Environment name：`uptcg-app`
- Container image：`universal`
- Runtime：Node.js `22.13.0` 或兼容的 Node.js 22
- Setup：Automatic（仓库包含 `package-lock.json`，等价目标为 `npm ci`）
- Container caching：On
- Agent internet access：Off
- Environment variables：无
- Secrets：无；不要提供 Cloudflare、GitHub、数据库或生产密钥

Cloud task 只使用 GitHub 中已提交的代码。不要向环境提供宿主机的
`/Users/rei/Library/Application Support/UPTCG/data`，也不要运行生产
卡牌同步。

## Linear

1. 在 Codex Settings → Connectors 安装并连接 `Codex for Linear`。
2. 在测试 Issue 中评论 `@Codex`，按提示选择 Linear 工作区。
3. 首次委派明确写出 `jibril2333/uptcg-app`。
4. 在 Linear Activity 和关联的 Codex Cloud chat 中检查进度。

建议状态：

```text
Backlog → Ready for Codex → In Progress → Human Review → Done
```

建议标签：`codex-ready`。

在 Linear Team Settings → Triage 中创建规则：

```text
条件：
Label = codex-ready
Status = Ready for Codex

动作：
Delegate → Codex
```

先用一个低风险测试 Issue 验证仓库选择、任务范围和 PR 创建行为。
任务正文使用 [linear-issue-template.md](./linear-issue-template.md)。

## GitHub 审核保护

在 `main` 的 branch protection/ruleset 中：

- Require a pull request before merging
- Require status checks to pass：`Pull request checks / test`
- 至少保留一次人工审核
- 禁止自动化直接推送 `main`

`.github/workflows/ci.yml` 只在 GitHub 托管的 Ubuntu runner 上检查 PR。
当前仓库已有 13 条 lint error，因此 lint 步骤会运行并展示结果，但暂时使用
`continue-on-error`，强制门禁是包含生产构建的 `npm test`。清理既有 lint
基线后，应删除 `continue-on-error`，把 lint 升级为强制门禁。

现有 `.github/workflows/deploy.yml` 仍只在 `main` push 或人工触发时使用
本机 `uptcg` runner。Codex Cloud 不会部署，但人工合并到 `main` 会触发
生产部署，因此合并即代表批准部署。

## 首次验收

- [ ] Codex GitHub Connector 只获得所需仓库权限
- [ ] Cloud Environment 指向 `jibril2333/uptcg-app`
- [ ] Environment 没有生产密钥，Agent internet access 为 Off
- [ ] `main` 分支保护要求 PR 与 CI
- [ ] Linear 已连接 Codex
- [ ] 测试 Issue 能创建独立 Codex Cloud chat
- [ ] Codex 回写 Linear 进度和结果
- [ ] Codex 只创建 PR，没有合并、同步生产数据或部署
