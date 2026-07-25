import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

async function render(pathname = "/") {
  globalThis.__UPTCG_CARD_CATALOG__ = JSON.parse(
    await readFile(path.join(projectRoot, "data/cards/catalog.json"), "utf8"),
  );
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the UPTCG homepage without the banner carousel", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>UPTCG｜Union Arena 中文組牌工具<\/title>/i);
  assert.match(html, /最強大的中文組牌神器/);
  assert.match(html, /我的置顶/);
  assert.match(html, /所有系列/);
  assert.match(html, /共 <!-- -->56<!-- --> 个作品/);
  assert.match(html, /添加到我的置顶/);
  assert.match(html, /href="\/cards\?series=MST"/);
  assert.match(html, /href="\/cards\?series=EVA"/);
  assert.match(html, /href="\/collection"/);
  assert.match(html, /我的收集/);
  assert.doesNotMatch(html, /Tier 表|上位卡表|模擬器|玩家社群/);
  assert.doesNotMatch(html, /WHY UPTCG|為什麼選擇 UPTCG|全系列中文翻譯|智慧組牌系統/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|火焰樹|貓貓TCG/);
});

test("server-renders the locally cached official card catalog", async () => {
  const response = await render("/cards");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /系列卡表/);
  assert.match(html, /先选择作品/);
  assert.match(html, /新世紀福音戰士/);
  assert.match(html, /無職轉生/);
  assert.match(html, /目前收录/);
  assert.match(html, /<strong>56<\/strong> 个作品/);
  assert.match(html, /<strong>10265<\/strong> 张卡牌/);
  assert.match(html, /3<!-- --> 个产品 · <!-- -->173<!-- --> 张卡牌/);
  assert.match(html, /2<!-- --> 个产品 · <!-- -->122<!-- --> 张卡牌/);
  assert.match(html, /偶像大師 灰姑娘女孩/);
  assert.match(html, /UNION ARENA 通用卡/);
  assert.match(html, /\/assets\/series\/EVA\.jpg/);
  assert.match(html, /UNION ARENA 官方卡表/);
});

test("all official series products have complete local data and images", async () => {
  const catalog = JSON.parse(await readFile(path.join(projectRoot, "data/cards/catalog.json"), "utf8"));
  assert.equal(catalog.series.length, 168);
  assert.equal(new Set(catalog.series.map((product) => product.workCode)).size, 56);
  assert.equal(catalog.series.filter((product) => product.sourceSeriesId).length, 59);

  let cardCount = 0;
  for (const product of catalog.series) {
    assert.ok(Array.isArray(product.colors), product.setCode);
    const data = JSON.parse(await readFile(path.join(projectRoot, product.dataFile), "utf8"));
    assert.equal(data.cards.length, product.cardCount, product.setCode);
    assert.equal(data.workCode, product.workCode, product.setCode);
    assert.ok(existsSync(path.join(projectRoot, "public", product.dataUrl)), product.dataUrl);
    for (const card of data.cards) {
      assert.ok(existsSync(path.join(projectRoot, "public", card.image)), card.image);
    }
    cardCount += data.cards.length;
  }

  assert.equal(cardCount, 10265);
});

test("server-renders the local deck library", async () => {
  const response = await render("/decks");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>我的牌組｜UPTCG<\/title>/);
  assert.match(html, /我的牌組庫/);
  assert.match(html, /新建牌組/);
  assert.match(html, /href="\/decks\/new"/);
  assert.match(html, /牌组保存在这台 Mac 的数据库中/);
});

test("server-renders the local card collection tracker", async () => {
  const response = await render("/collection");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>我的收集｜UPTCG<\/title>/);
  assert.match(html, /MY UNION ARENA COLLECTION/);
  assert.match(html, /记录你已经拥有的卡牌和数量/);
  assert.match(html, /资料保存在这台 Mac 的数据库中/);
  assert.match(html, /SELECT A SERIES/);
  assert.match(html, /先选择作品/);
  assert.match(html, /目前收录 <!-- -->56<!-- --> 个作品/);
  assert.match(html, /新世紀福音戰士/);
  assert.match(html, /無職轉生/);
  assert.match(html, /已拥有 <!-- -->0<!-- --> 种 · <!-- -->0<!-- --> 张/);
  assert.match(html, /href="\/collection"/);
  assert.doesNotMatch(html, /只看已拥有/);
  assert.doesNotMatch(html, /aria-label="卡牌产品"/);
});

test("server-renders the work and color setup before the deck editor", async () => {
  const response = await render("/decks/new");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>新建牌組｜UPTCG<\/title>/);
  assert.match(html, /NEW DECK/);
  assert.match(html, /先选择作品和颜色，再开始挑选卡牌/);
  assert.match(html, /STEP 01/);
  assert.match(html, /选择作品/);
  assert.match(html, /STEP 02/);
  assert.match(html, /选择颜色/);
  assert.match(html, /红色/);
  assert.match(html, /蓝色/);
  assert.match(html, /开始选择卡牌/);
  assert.match(html, /無職轉生/);
  assert.match(html, /新世紀福音戰士/);
  assert.doesNotMatch(html, /牌組編輯器|保存牌組|导出图片/);
});
