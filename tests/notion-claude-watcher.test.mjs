import assert from "node:assert/strict";
import test from "node:test";
import {
  blockToText,
  buildBrief,
  createMentionPattern,
  findTriggers,
  pageTitle,
  selectName,
  shortId,
} from "../scripts/notion-claude-watcher.mjs";

const pattern = createMentionPattern("@claude");

function comment(id, text, createdById = "user-1") {
  return { created_by: { id: createdById }, id, rich_text: [{ plain_text: text }] };
}

test("mention pattern matches whole-word requests only", () => {
  assert.ok(pattern.test("@claude 请修一下移动端溢出"));
  assert.ok(pattern.test("cc @claude"));
  assert.ok(!pattern.test("@claude-bot 不算"));
  assert.ok(!pattern.test("claude 没有 at 不算"));
  assert.ok(!pattern.test("邮件是 rei@claudemail.com"));
});

test("findTriggers picks up user mentions and ignores the watcher's own comments", () => {
  const triggers = findTriggers({
    body: "",
    comments: [
      comment("c1", "先放着"),
      comment("c2", "🤖 已交给 Claude 处理。分支：claude/notion-x", "bot-self"),
      comment("c3", "@claude 请修掉溢出并加回归测试"),
    ],
    mention: "@claude",
    pattern,
    scanPageBody: true,
    selfBotId: "bot-self",
    title: "卡表筛选器移动端溢出",
  });

  assert.deepEqual(
    triggers.map((trigger) => trigger.key),
    ["comment:c3"],
  );
  assert.equal(triggers[0].request, "@claude 请修掉溢出并加回归测试");
});

test("findTriggers never re-fires on a mention the watcher itself echoed back", () => {
  const triggers = findTriggers({
    body: "",
    comments: [comment("c9", "🤖 已交给 Claude 处理，@claude 会在分支上开工", "bot-self")],
    mention: "@claude",
    pattern,
    scanPageBody: false,
    selfBotId: "bot-self",
    title: "无关卡片",
  });

  assert.deepEqual(triggers, []);
});

test("findTriggers falls back to the page body with a stable dedupe key", () => {
  const input = {
    body: "@claude 把卡表同步脚本的重试改成指数退避",
    comments: [],
    mention: "@claude",
    pattern,
    scanPageBody: true,
    selfBotId: "bot-self",
    title: "同步重试",
  };
  const [first] = findTriggers(input);
  const [second] = findTriggers(input);

  assert.ok(first.key.startsWith("page:"));
  assert.equal(first.key, second.key, "同样的正文必须得到同一个去重 key");

  assert.deepEqual(findTriggers({ ...input, scanPageBody: false }), []);
});

test("blockToText renders the Notion block types a task card actually uses", () => {
  const rich = (text) => ({ rich_text: [{ plain_text: text }] });
  assert.equal(blockToText({ heading_2: rich("目标"), type: "heading_2" }), "## 目标");
  assert.equal(blockToText({ bulleted_list_item: rich("不溢出"), type: "bulleted_list_item" }), "- 不溢出");
  assert.equal(
    blockToText({ to_do: { checked: true, ...rich("补测试") }, type: "to_do" }),
    "- [x] 补测试",
  );
  assert.equal(blockToText({ paragraph: rich(""), type: "paragraph" }), "");
  assert.equal(blockToText({ type: "divider" }), "");
});

test("page properties are read defensively", () => {
  const page = {
    id: "3c29ace6-0c51-8033-a80c-c1201b23af45",
    properties: {
      Name: { title: [{ plain_text: "卡表筛选器移动端溢出" }], type: "title" },
      Priority: { select: { name: "High" }, type: "select" },
      Status: { status: { name: "Not started" }, type: "status" },
    },
  };

  assert.equal(pageTitle(page), "卡表筛选器移动端溢出");
  assert.equal(selectName(page, "Status"), "Not started");
  assert.equal(selectName(page, "Priority"), "High");
  assert.equal(selectName(page, "Assignee"), "");
  assert.equal(pageTitle({}), "(无标题)");
  assert.equal(shortId(page.id), "3c29ace6");
});

test("buildBrief carries card context and truncates runaway bodies", () => {
  const page = {
    properties: { Status: { status: { name: "Not started" }, type: "status" } },
    url: "https://app.notion.com/3c29ace60c518033a80cc1201b23af45",
  };
  const brief = buildBrief({
    body: "## 目标\n- 移动端筛选器不溢出",
    page,
    request: "@claude 请修掉溢出",
    title: "卡表筛选器移动端溢出",
  });

  assert.match(brief, /# Notion 任务：卡表筛选器移动端溢出/);
  assert.match(brief, /卡片链接：https:\/\/app\.notion\.com\//);
  assert.match(brief, /Status：Not started/);
  assert.match(brief, /Priority：\(未设置\)/);
  assert.match(brief, /## 触发请求\n@claude 请修掉溢出$/);

  const truncated = buildBrief({
    body: "长".repeat(500),
    maxLength: 120,
    page,
    request: "@claude go",
    title: "很长的卡片",
  });
  assert.ok(truncated.length <= 120 + "\n…（正文已截断）".length);
  assert.match(truncated, /…（正文已截断）$/);
});
