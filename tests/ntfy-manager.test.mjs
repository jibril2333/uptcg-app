import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createNtfyManager } from "../scripts/ntfy-manager.mjs";

test("ntfy settings persist securely and publish with bearer authentication", async (t) => {
  const cardDataRoot = await mkdtemp(path.join(os.tmpdir(), "uptcg-ntfy-"));
  t.after(() => rm(cardDataRoot, { force: true, recursive: true }));
  const requests = [];
  const manager = createNtfyManager({
    cardDataRoot,
    fetchImpl: async (url, init) => {
      requests.push({ init, url });
      return new Response("{}", { status: 200 });
    },
    now: () => new Date("2026-08-02T12:00:00.000Z"),
  });
  await manager.initialize();
  const configured = await manager.configure({
    enabled: true,
    serverUrl: "https://notify.example.com/",
    token: "tk_secret",
    topic: "uptcg-alerts",
  });
  assert.equal(configured.enabled, true);
  assert.equal(configured.hasToken, true);
  assert.equal(Object.hasOwn(configured, "token"), false, "the API view must never expose the token");

  await manager.sendTest();
  assert.equal(requests[0].url, "https://notify.example.com");
  assert.equal(requests[0].init.headers.authorization, "Bearer tk_secret");
  assert.equal(requests[0].init.headers["content-type"], "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    message: "ntfy 通知配置正常。",
    priority: 3,
    tags: ["white_check_mark", "cards"],
    title: "UPTCG 测试通知",
    topic: "uptcg-alerts",
  });
  await manager.notifyCardUpdate({
    addedCardCount: 3,
    catalog: { cardCount: 103, productCount: 4, workCount: 2 },
    status: "success",
  });
  assert.deepEqual(JSON.parse(requests[1].init.body), {
    message: "发现 3 张新卡片。当前已收录 2 个作品、4 个分类，共 103 张卡牌。",
    priority: 3,
    tags: ["white_check_mark", "cards"],
    title: "UPTCG 发现新卡片",
    topic: "uptcg-alerts",
  });
  assert.equal(manager.publicSettings().lastSentAt, "2026-08-02T12:00:00.000Z");

  const saved = JSON.parse(await readFile(path.join(cardDataRoot, "ntfy-settings.json"), "utf8"));
  assert.equal(saved.token, "tk_secret");
});

test("ntfy notifications can be disabled and reject unsafe server URLs", async (t) => {
  const cardDataRoot = await mkdtemp(path.join(os.tmpdir(), "uptcg-ntfy-disabled-"));
  t.after(() => rm(cardDataRoot, { force: true, recursive: true }));
  let calls = 0;
  const manager = createNtfyManager({
    cardDataRoot,
    fetchImpl: async () => { calls += 1; return new Response("{}", { status: 200 }); },
  });
  await manager.initialize();
  await manager.configure({ enabled: false, serverUrl: "https://ntfy.sh", topic: "uptcg" });
  await manager.notifyCardUpdate({ status: "success", catalog: { cardCount: 1, productCount: 1, workCount: 1 } });
  assert.equal(calls, 0);
  await assert.rejects(
    manager.configure({ enabled: true, serverUrl: "http://ntfy.example.com", topic: "uptcg" }),
    /必须使用 HTTPS/,
  );
});
