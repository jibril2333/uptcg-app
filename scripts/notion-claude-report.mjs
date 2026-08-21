#!/usr/bin/env node
/**
 * 把 Claude Code Action 的执行结果回写到触发它的 Notion 卡片评论里。
 *
 * 由 `.github/workflows/notion-claude.yml` 在 Claude 步骤之后调用，
 * 只写一条 Notion 评论，不改任何卡片属性。
 */
import process from "node:process";

const NOTION_API = "https://api.notion.com/v1";
const GITHUB_API = "https://api.github.com";

function requiredEnv(name) {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function optionalEnv(name, fallback = "") {
  return (process.env[name] ?? "").trim() || fallback;
}

async function findPullRequest({ branch, repository, token }) {
  if (!branch || !token) return null;
  const owner = repository.split("/")[0];
  const query = new URLSearchParams({ head: `${owner}:${branch}`, per_page: "1", state: "all" });
  const response = await fetch(`${GITHUB_API}/repos/${repository}/pulls?${query}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) return null;
  const [pullRequest] = await response.json();
  return pullRequest?.html_url ?? null;
}

async function postComment({ content, pageId, token }) {
  const response = await fetch(`${NOTION_API}/comments`, {
    body: JSON.stringify({ parent: { page_id: pageId }, rich_text: [{ text: { content } }] }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": optionalEnv("NOTION_VERSION", "2022-06-28"),
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Notion 评论失败 ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
}

async function main() {
  const branch = optionalEnv("TASK_BRANCH");
  const conclusion = optionalEnv("CLAUDE_CONCLUSION", "unknown");
  const notionToken = requiredEnv("NOTION_TOKEN");
  const pageId = requiredEnv("NOTION_PAGE_ID");
  const repository = requiredEnv("GITHUB_REPOSITORY");
  const runUrl = optionalEnv("RUN_URL");

  const pullRequestUrl = await findPullRequest({ branch, repository, token: optionalEnv("GH_TOKEN") });
  const headline = conclusion === "success" ? "🤖 Claude 已完成这张卡片。" : `🤖 Claude 执行结束（状态：${conclusion}）。`;
  const lines = [headline];
  if (pullRequestUrl) lines.push(`PR：${pullRequestUrl}`);
  else lines.push(`未找到 PR。分支：${branch || "(未知)"}`);
  if (runUrl) lines.push(`运行日志：${runUrl}`);
  lines.push("PR 需要人工审核后再合并，合并到 main 会触发生产部署。");

  await postComment({ content: lines.join("\n"), pageId, token: notionToken });
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? String(error)}\n`);
  process.exitCode = 1;
});
