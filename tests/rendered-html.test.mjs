import assert from "node:assert/strict";
import test from "node:test";

const syncedAt = "2026-07-15T17:47:14.525Z";
const catalog = {
  syncedAt,
  series: [
    {
      cardCount: 27,
      colors: ["赤", "黄", "紫"],
      dataUrl: "/cards/ua44st/data.json",
      officialListUrl: "https://www.unionarena-tcg.com/jp/cardlist/?search=true&series=570044",
      productKey: "ua44st",
      productName: "ヱヴァンゲリヲン新劇場版【UA44ST】",
      seriesId: "570044",
      setCode: "UA44ST",
      syncedAt,
      workCode: "EVA",
    },
    {
      cardCount: 136,
      colors: ["赤", "黄", "紫"],
      dataUrl: "/cards/ua44bt/data.json",
      officialListUrl: "https://www.unionarena-tcg.com/jp/cardlist/?search=true&series=570144",
      productKey: "ua44bt",
      productName: "ヱヴァンゲリヲン新劇場版【UA44BT】",
      seriesId: "570144",
      setCode: "UA44BT",
      syncedAt,
      workCode: "EVA",
    },
    {
      cardCount: 120,
      colors: ["青", "緑"],
      dataUrl: "/cards/ua54bt/data.json",
      officialListUrl: "https://www.unionarena-tcg.com/jp/cardlist/?search=true&series=570154",
      productKey: "ua54bt",
      productName: "無職転生 ～異世界行ったら本気だす～【UA54BT】",
      seriesId: "570154",
      setCode: "UA54BT",
      syncedAt,
      workCode: "MST",
    },
    {
      cardCount: 10,
      colors: ["赤", "黄"],
      dataUrl: "/cards/promo-eva/data.json",
      officialListUrl: "https://www.unionarena-tcg.com/jp/cardlist/?search=true&series=570901",
      productKey: "promo-eva",
      productName: "プロモーションカード",
      seriesId: "570901-EVA",
      setCode: "PR",
      sourceSeriesId: "570901",
      syncedAt,
      workCode: "EVA",
    },
    {
      cardCount: 2,
      colors: ["青", "緑"],
      dataUrl: "/cards/promo-mst/data.json",
      officialListUrl: "https://www.unionarena-tcg.com/jp/cardlist/?search=true&series=570901",
      productKey: "promo-mst",
      productName: "プロモーションカード",
      seriesId: "570901-MST",
      setCode: "PR",
      sourceSeriesId: "570901",
      syncedAt,
      workCode: "MST",
    },
    {
      cardCount: 1,
      colors: ["緑"],
      coverImage: "/cards/ua60bt/UA60BT_NEW-1-001.png",
      dataUrl: "/cards/ua60bt/data.json",
      officialListUrl: "https://www.unionarena-tcg.com/jp/cardlist/?search=true&series=570160",
      productKey: "ua60bt",
      productName: "新規作品タイトル【UA60BT】",
      seriesId: "570160",
      setCode: "UA60BT",
      syncedAt,
      workCode: "NEW",
    },
  ],
};

async function render(pathname = "/") {
  globalThis.__UPTCG_CARD_CATALOG__ = catalog;
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
  assert.match(html, /我的置顶/);
  assert.match(html, /所有系列/);
  assert.match(html, /共 <!-- -->57<!-- --> 个作品/);
  assert.match(html, /添加到我的置顶/);
  assert.match(html, /href="\/cards\?series=MST"/);
  assert.match(html, /href="\/cards\?series=EVA"/);
  assert.match(html, /href="\/cards\?series=NEW"/);
  assert.match(html, /新規作品タイトル/);
  assert.match(html, /href="\/collection"/);
  assert.match(html, /href="\/rules"/);
  assert.match(html, /href="\/settings"/);
  assert.match(html, /我的收集/);
  assert.match(html, /規則與禁卡/);
  assert.match(html, /設定/);
  assert.doesNotMatch(html, /最強大的中文組牌神器|即時翻譯|登入 Google/);
  assert.doesNotMatch(html, /UPTCG 由熱愛|UPTCG 資料庫|關於我們|免責聲明|隱私政策|服務條款/);
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
  assert.match(html, /<strong>3<\/strong> 个作品/);
  assert.match(html, /<strong>296<\/strong> 张卡牌/);
  assert.match(html, /3<!-- --> 个产品 · <!-- -->173<!-- --> 张卡牌/);
  assert.match(html, /2<!-- --> 个产品 · <!-- -->122<!-- --> 张卡牌/);
  assert.match(html, /\/assets\/series\/EVA\.jpg/);
  assert.match(html, /\/cards\/ua60bt\/UA60BT_NEW-1-001\.png/);
  assert.match(html, /新規作品タイトル/);
  assert.match(html, /UNION ARENA 官方卡表/);
});

test("server-renders the official rules and current restriction table", async () => {
  const response = await render("/rules");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>規則與禁卡表｜UPTCG<\/title>/);
  assert.match(html, /牌组构筑规则/);
  assert.match(html, /主牌组张数/);
  assert.match(html, /现行禁限卡表/);
  assert.match(html, /EVA-1-051/);
  assert.match(html, /EVA-1-004/);
  assert.match(html, /CGH-1-083/);
  assert.match(html, /CGD-1-070/);
  assert.match(html, /限制 2 张/);
  assert.match(html, /SAO-2-029/);
  assert.match(html, /2026\.04\.01/);
  assert.match(html, /核对官方原文/);
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
  assert.match(html, /目前收录 <!-- -->3<!-- --> 个作品/);
  assert.match(html, /新世紀福音戰士/);
  assert.match(html, /無職轉生/);
  assert.match(html, /新規作品タイトル/);
  assert.match(html, /已拥有 <!-- -->0<!-- --> 种 · <!-- -->0<!-- --> 张/);
  assert.match(html, /href="\/collection"/);
  assert.doesNotMatch(html, /只看已拥有/);
  assert.doesNotMatch(html, /aria-label="卡牌产品"/);
});

test("server-renders personal settings and backup controls", async () => {
  const response = await render("/settings");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>設定｜UPTCG<\/title>/);
  assert.match(html, /SETTINGS/);
  assert.match(html, /数据概览/);
  assert.match(html, /导出备份/);
  assert.match(html, /恢复备份/);
  assert.match(html, /合并导入，不清空现有资料/);
  assert.match(html, /卡牌数据/);
  assert.match(html, /立即检查更新/);
  assert.match(html, /自动更新 ·/);
  assert.match(html, /自动更新频率/);
  assert.match(html, /每 6 小时/);
  assert.match(html, /每 12 小时/);
  assert.match(html, /每天/);
  assert.match(html, /每 2 天/);
  assert.match(html, /每周/);
  assert.match(html, /自动更新时间（日本时间）/);
  assert.match(html, /新作品与新分类会自动收录/);
  assert.match(html, /ntfy 通知/);
  assert.match(html, /服务器/);
  assert.match(html, /Topic/);
  assert.match(html, /访问令牌/);
  assert.match(html, /通知 ·/);
  assert.match(html, /测试/);
  assert.match(html, /3<!-- --> 个作品 · <!-- -->6<!-- --> 个分类/);
  assert.match(html, /296<!-- --> <small>张<\/small>/);
  assert.doesNotMatch(html, /卡表与运行环境|Docker · SQLite|Cloudflare Tunnel|持久化储存/);
  assert.doesNotMatch(html, /管理这台 Mac 上的个人资料备份/);
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
  assert.match(html, /新規作品タイトル/);
  assert.doesNotMatch(html, /牌組編輯器|保存牌組|导出图片/);
});
