#!/usr/bin/env node
/**
 * Notion 看板 → Claude 派单守护进程。
 *
 * 在 Notion 任务卡片的评论（或正文）里写 `@claude ...`，本进程轮询到之后，
 * 通过 GitHub `repository_dispatch` 触发 `.github/workflows/notion-claude.yml`，
 * 由 Claude Code Action 在 GitHub 托管 runner 上开分支实现并创建 PR。
 *
 * 本进程只读 Notion、写 Notion 评论、调用 GitHub dispatch API。
 * 它不构建、不部署，也不接触生产卡牌数据。
 *
 * 用法：
 *   node scripts/notion-claude-watcher.mjs            # 常驻轮询
 *   node scripts/notion-claude-watcher.mjs --once     # 只跑一轮（用于验证配置）
 *   node scripts/notion-claude-watcher.mjs --once --dry-run  # 只打印，不触发、不评论
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const NOTION_API = "https://api.notion.com/v1";
const GITHUB_API = "https://api.github.com";
const ACK_MARKER = "🤖";
const MAX_BRIEF_LENGTH = 6000;
const MAX_PROCESSED_KEYS = 500;

const options = {
  dryRun: process.argv.includes("--dry-run"),
  once: process.argv.includes("--once"),
};

function requiredEnv(name) {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function optionalEnv(name, fallback) {
  const value = (process.env[name] ?? "").trim();
  return value || fallback;
}

function positiveIntEnv(name, fallback) {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} 必须是正整数`);
  return parsed;
}

function loadConfig() {
  return {
    databaseId: optionalEnv("NOTION_TASKS_DATABASE_ID", "2599ace6-0c51-8064-816c-d757f04287d6"),
    dispatchToken: requiredEnv("GITHUB_DISPATCH_TOKEN"),
    eventType: optionalEnv("GITHUB_DISPATCH_EVENT", "notion-task"),
    lookbackHours: positiveIntEnv("NOTION_LOOKBACK_HOURS", 24),
    mention: optionalEnv("NOTION_MENTION", "@claude"),
    notionToken: requiredEnv("NOTION_TOKEN"),
    notionVersion: optionalEnv("NOTION_VERSION", "2022-06-28"),
    pageLimit: positiveIntEnv("NOTION_PAGE_LIMIT", 25),
    pollSeconds: positiveIntEnv("POLL_INTERVAL_SECONDS", 30),
    repository: optionalEnv("GITHUB_REPOSITORY", "jibril2333/uptcg-app"),
    scanPageBody: optionalEnv("NOTION_SCAN_PAGE_BODY", "true") !== "false",
    statePath: optionalEnv(
      "NOTION_WATCHER_STATE",
      path.join(os.homedir(), ".local", "state", "uptcg", "notion-claude-watcher.json"),
    ),
  };
}

/** 运行期配置，在 main() 里装载，import 本模块做测试时不会读环境变量。 */
let config;

export function createMentionPattern(mention) {
  // 前后都要断开：`@claude-bot` 和 `rei@claudemail.com` 都不算触发。
  const escaped = mention.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\w@-])${escaped}(?![\\w-])`, "i");
}

/** 由 config.mention 派生，main() 里装载。 */
let mentionPattern;

function log(message) {
  process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

function logError(message) {
  process.stderr.write(`[${new Date().toISOString()}] ${message}\n`);
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, filePath);
}

async function readState() {
  try {
    const parsed = JSON.parse(await readFile(config.statePath, "utf8"));
    return { processed: parsed?.processed && typeof parsed.processed === "object" ? parsed.processed : {} };
  } catch {
    return { processed: {} };
  }
}

async function saveState(state) {
  // dry-run 不写状态，否则试跑一次就会把待处理的请求标记成已处理。
  if (options.dryRun) return;
  const entries = Object.entries(state.processed).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const kept = entries.slice(-MAX_PROCESSED_KEYS);
  state.processed = Object.fromEntries(kept);
  await writeJsonAtomic(config.statePath, state);
}

async function notionRequest(endpoint, init = {}) {
  const response = await fetch(`${NOTION_API}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": config.notionVersion,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Notion ${endpoint} 返回 ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
  return response.json();
}

export function richTextToPlain(richText) {
  if (!Array.isArray(richText)) return "";
  return richText.map((item) => item?.plain_text ?? "").join("");
}

export function pageTitle(page) {
  const titleProperty = Object.values(page?.properties ?? {}).find((property) => property?.type === "title");
  return richTextToPlain(titleProperty?.title).trim() || "(无标题)";
}

export function selectName(page, propertyName) {
  const property = page?.properties?.[propertyName];
  if (property?.type === "status") return property.status?.name ?? "";
  if (property?.type === "select") return property.select?.name ?? "";
  return "";
}

export function shortId(id) {
  return id.replace(/-/g, "").slice(0, 8);
}

function compactTimestamp(date) {
  return date.toISOString().replace(/[-:T]/g, "").slice(0, 12);
}

function hashKey(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function blockToText(block) {
  const payload = block?.[block?.type];
  const text = richTextToPlain(payload?.rich_text);
  if (!text) return "";
  switch (block.type) {
    case "bulleted_list_item":
      return `- ${text}`;
    case "numbered_list_item":
      return `1. ${text}`;
    case "to_do":
      return `- [${payload?.checked ? "x" : " "}] ${text}`;
    case "heading_1":
      return `# ${text}`;
    case "heading_2":
      return `## ${text}`;
    case "heading_3":
      return `### ${text}`;
    case "code":
      return `\`\`\`\n${text}\n\`\`\``;
    default:
      return text;
  }
}

async function fetchPageBody(pageId) {
  const lines = [];
  let cursor;
  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const result = await notionRequest(`/blocks/${pageId}/children?${query}`);
    for (const block of result.results ?? []) {
      const line = blockToText(block);
      if (line) lines.push(line);
    }
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
  return lines.join("\n").trim();
}

async function fetchComments(pageId) {
  const comments = [];
  let cursor;
  do {
    const query = new URLSearchParams({ block_id: pageId, page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const result = await notionRequest(`/comments?${query}`);
    comments.push(...(result.results ?? []));
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
  return comments;
}

async function fetchRecentTasks() {
  const since = new Date(Date.now() - config.lookbackHours * 3600_000).toISOString();
  const result = await notionRequest(`/databases/${config.databaseId}/query`, {
    body: JSON.stringify({
      filter: { timestamp: "last_edited_time", last_edited_time: { on_or_after: since } },
      page_size: config.pageLimit,
      sorts: [{ direction: "descending", timestamp: "last_edited_time" }],
    }),
    method: "POST",
  });
  return result.results ?? [];
}

async function postNotionComment(pageId, content) {
  if (options.dryRun) {
    log(`[dry-run] 会在 ${pageId} 留言：${content}`);
    return;
  }
  await notionRequest("/comments", {
    body: JSON.stringify({ parent: { page_id: pageId }, rich_text: [{ text: { content } }] }),
    method: "POST",
  });
}

async function dispatchToGithub(clientPayload) {
  if (options.dryRun) {
    log(`[dry-run] 会触发 ${config.repository}：${JSON.stringify(clientPayload).slice(0, 300)}`);
    return;
  }
  const response = await fetch(`${GITHUB_API}/repos/${config.repository}/dispatches`, {
    body: JSON.stringify({ client_payload: clientPayload, event_type: config.eventType }),
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.dispatchToken}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`GitHub dispatch 返回 ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
}

export function buildBrief({ body, maxLength = MAX_BRIEF_LENGTH, page, request, title }) {
  const sections = [
    `# Notion 任务：${title}`,
    `卡片链接：${page.url}`,
    `Status：${selectName(page, "Status") || "(未设置)"}　Priority：${selectName(page, "Priority") || "(未设置)"}`,
    "",
    "## 卡片正文",
    body || "(空)",
    "",
    "## 触发请求",
    request,
  ];
  const brief = sections.join("\n");
  return brief.length > maxLength ? `${brief.slice(0, maxLength)}\n…（正文已截断）` : brief;
}

export function findTriggers({ body, comments, mention, pattern, scanPageBody, selfBotId, title }) {
  const triggers = [];
  for (const comment of comments) {
    const text = richTextToPlain(comment.rich_text).trim();
    if (!text || text.startsWith(ACK_MARKER)) continue;
    if (comment.created_by?.id === selfBotId) continue;
    if (!pattern.test(text)) continue;
    triggers.push({ key: `comment:${comment.id}`, request: text });
  }
  if (triggers.length > 0) return triggers;

  const pageText = [title, body].filter(Boolean).join("\n");
  if (scanPageBody && pattern.test(pageText)) {
    triggers.push({ key: `page:${hashKey(pageText)}`, request: `卡片正文中提及 ${mention}，按正文内容执行。` });
  }
  return triggers;
}

async function processPage(page, state, selfBotId) {
  const status = selectName(page, "Status");
  if (status === "Done" || status === "Canceled") return;

  const title = pageTitle(page);
  const comments = await fetchComments(page.id);
  const needsBody = config.scanPageBody || comments.some((comment) => mentionPattern.test(richTextToPlain(comment.rich_text)));
  const body = needsBody ? await fetchPageBody(page.id) : "";

  const triggers = findTriggers({
    body,
    comments,
    mention: config.mention,
    pattern: mentionPattern,
    scanPageBody: config.scanPageBody,
    selfBotId,
    title,
  }).filter((trigger) => !state.processed[trigger.key]);
  if (triggers.length === 0) return;

  // 一张卡片一次只派一单，用最新的那条请求。
  const trigger = triggers[triggers.length - 1];
  const branch = `claude/notion-${shortId(page.id)}-${compactTimestamp(new Date())}`;

  log(`派单：${title}（${page.url}）→ ${branch}`);
  await dispatchToGithub({
    branch,
    brief: buildBrief({ body, page, request: trigger.request, title }),
    page_id: page.id,
    page_url: page.url,
    title,
  });

  for (const item of triggers) state.processed[item.key] = new Date().toISOString();
  await saveState(state);

  await postNotionComment(
    page.id,
    `${ACK_MARKER} 已交给 Claude 处理。分支：${branch}\n` +
      `进度：https://github.com/${config.repository}/actions/workflows/notion-claude.yml\n` +
      "完成后会在这里回报结果和 PR 链接。",
  );
}

async function runCycle(selfBotId) {
  const state = await readState();
  const pages = await fetchRecentTasks();
  for (const page of pages) {
    try {
      await processPage(page, state, selfBotId);
    } catch (error) {
      logError(`处理卡片 ${page.id} 失败：${error.message}`);
    }
  }
}

async function main() {
  config = loadConfig();
  mentionPattern = createMentionPattern(config.mention);

  const self = await notionRequest("/users/me");
  const selfBotId = self?.id ?? "";
  log(`已连接 Notion（integration: ${self?.name ?? "unknown"}），监听 ${config.mention}，仓库 ${config.repository}`);
  if (options.dryRun) log("dry-run 模式：不会触发 GitHub，也不会写 Notion 评论");

  for (;;) {
    try {
      await runCycle(selfBotId);
    } catch (error) {
      logError(`轮询失败：${error.message}`);
    }
    if (options.once) return;
    await new Promise((resolve) => setTimeout(resolve, config.pollSeconds * 1000));
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    logError(error.stack ?? String(error));
    process.exitCode = 1;
  });
}
