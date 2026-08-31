import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OFFICIAL_ORIGIN = process.env.UPTCG_OFFICIAL_ORIGIN || "https://www.unionarena-tcg.com";
const DEFAULT_SERIES = "570154";
const MIXED_CARD_SERIES = new Set(["570801", "570901"]);
const MIXED_SERIES_META = {
  "570801": { key: "limited", setCode: "限定" },
  "570901": { key: "promo", setCode: "PR" },
};
const root = process.cwd();
const configuredDataRoot = process.env.UPTCG_CARD_DATA_DIR;
const dataRoot = path.resolve(configuredDataRoot || path.join(root, "data/cards"));
const publicCardsRoot = path.resolve(process.env.UPTCG_CARD_ASSET_DIR || path.join(root, "public/cards"));

const cliSeries = process.argv.find((arg) => arg.startsWith("--series="));
const syncAll = process.argv.includes("--all");
const force = process.argv.includes("--force");
const refresh = process.argv.includes("--refresh");
const cliConcurrency = process.argv.find((arg) => arg.startsWith("--concurrency="));
const concurrency = Math.max(1, Number.parseInt(cliConcurrency?.split("=")[1] || "6", 10));
const requestedSeriesIds = (cliSeries?.split("=")[1] || DEFAULT_SERIES)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function decodeHtml(value = "") {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}

function textFromHtml(fragment = "") {
  return decodeHtml(
    fragment
      .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, " [$1] ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function matchClass(html, tagName, className) {
  const pattern = new RegExp(
    `<${tagName}[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  );
  return html.match(pattern)?.[1] ?? "";
}

function imgAlts(fragment = "") {
  return [...fragment.matchAll(/<img[^>]*alt="([^"]*)"[^>]*>/gi)]
    .map((match) => decodeHtml(match[1]).trim())
    .filter(Boolean);
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ja,en;q=0.8",
          "User-Agent": "UPTCG-local-catalog-sync/1.0 (+local personal catalog)",
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message ?? lastError}`);
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function parseListPage(html, seriesId) {
  const optionPattern = new RegExp(`<option value="${seriesId}"[^>]*>([\\s\\S]*?)<\\/option>`, "i");
  const productName = textFromHtml(html.match(optionPattern)?.[1] ?? `UNION ARENA ${seriesId}`);
  const resultCount = Number.parseInt(html.match(/class="searchCount">(\d+)</)?.[1] ?? "0", 10);
  const cardPattern = /<a[^>]*class="[^"]*modalCardDataOpen[^"]*"[^>]*href="\.\/detail_iframe\.php\?card_no=([^"]+)"[^>]*>[\s\S]*?<img[^>]*data-src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi;
  const cards = [];

  for (const match of html.matchAll(cardPattern)) {
    const cardNo = decodeHtml(decodeURIComponent(match[1]));
    const listLabel = decodeHtml(match[3]);
    const name = listLabel.startsWith(cardNo) ? listLabel.slice(cardNo.length).trim() : listLabel;
    const imageOfficialUrl = new URL(decodeHtml(match[2]), OFFICIAL_ORIGIN).href;
    const imageFileName = new URL(imageOfficialUrl).pathname.split("/").pop();

    cards.push({
      cardNo,
      detailOfficialUrl: `${OFFICIAL_ORIGIN}/jp/cardlist/detail.php?card_no=${encodeURIComponent(cardNo)}`,
      detailSourceUrl: `${OFFICIAL_ORIGIN}/jp/cardlist/detail_iframe.php?card_no=${encodeURIComponent(cardNo)}`,
      imageFileName,
      imageOfficialUrl,
      name,
    });
  }

  if (!cards.length || (resultCount && cards.length !== resultCount)) {
    throw new Error(`Expected ${resultCount || "some"} cards for ${seriesId}, parsed ${cards.length}`);
  }

  return { cards, productName, resultCount };
}

function discoverSeriesIds(html) {
  const select = html.match(/<select[^>]*name="series"[^>]*>([\s\S]*?)<\/select>/i)?.[1] ?? "";
  const ids = [...select.matchAll(/<option[^>]*value="(\d+)"[^>]*>/gi)].map((match) => match[1]);
  return [...new Set(ids)];
}

function workCodeFromCardNo(cardNo = "") {
  const titlePart = cardNo.split("/")[1] ?? "";
  if (/^IMS_AP/i.test(titlePart)) return "IMS";
  const candidate = titlePart.match(/^([A-Z0-9]+)/i)?.[1]?.toUpperCase() ?? "";
  return candidate && !/^\d+$/.test(candidate) ? candidate : "UNI";
}

function inferWorkCode(cards) {
  const counts = new Map();
  for (const card of cards) {
    const workCode = workCodeFromCardNo(card.cardNo);
    if (workCode) counts.set(workCode, (counts.get(workCode) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

const COLOR_ORDER = ["赤", "青", "黄", "緑", "紫"];

function inferColors(cards) {
  const found = new Set(
    cards
      .map((card) => card.needEnergy?.match(/^[赤青黄緑紫]/)?.[0])
      .filter(Boolean),
  );
  return COLOR_ORDER.filter((color) => found.has(color));
}

function productIdentity(productName, firstCard, seriesId) {
  const officialCode = productName.match(/【\s*([^】]+?)\s*】/)?.[1]?.toUpperCase();
  const setCode = officialCode || firstCard.cardNo.split("/")[0].toUpperCase();
  return {
    productKey: officialCode ? officialCode.toLowerCase() : `special-${seriesId}`,
    setCode,
  };
}

function mixedProductIdentity(seriesId, workCode) {
  const meta = MIXED_SERIES_META[seriesId];
  if (!meta) throw new Error(`Unknown mixed card series ${seriesId}`);
  return {
    productKey: `${meta.key}-${workCode.toLowerCase()}`,
    setCode: meta.setCode,
  };
}

function parseDetailPage(html, fallback) {
  const nameBlock = matchClass(html, "h2", "cardNameCol");
  const ruby = textFromHtml(matchClass(nameBlock, "span", "rubyData"));
  const name = textFromHtml(nameBlock.replace(/<span[^>]*class="[^"]*rubyData[^"]*"[^>]*>[\s\S]*?<\/span>/i, ""));
  const titleBlock = matchClass(html, "dd", "cardDataTitleCol");
  const needEnergyBlock = matchClass(html, "dd", "cardDataContents") || "";
  const generatedEnergyBlock = matchClass(html, "dl", "generatedEnergyData");

  return {
    ...fallback,
    ap: textFromHtml(matchClass(matchClass(html, "dl", "apData"), "dd", "cardDataContents")),
    attributes: textFromHtml(matchClass(matchClass(html, "dl", "attributeData"), "dd", "cardDataContents")),
    bp: textFromHtml(matchClass(matchClass(html, "dl", "bpData"), "dd", "cardDataContents")),
    cardNo: textFromHtml(matchClass(html, "span", "cardNumData")) || fallback.cardNo,
    category: textFromHtml(matchClass(matchClass(html, "dl", "categoryData"), "dd", "cardDataContents")),
    effect: textFromHtml(matchClass(matchClass(html, "dl", "effectData"), "dd", "cardDataContents")),
    generatedEnergy: imgAlts(matchClass(generatedEnergyBlock, "dd", "cardDataContents")),
    name: name || fallback.name,
    needEnergy: imgAlts(matchClass(matchClass(html, "dl", "needEnergyData"), "dd", "cardDataContents"))[0] ?? textFromHtml(needEnergyBlock),
    product: textFromHtml(matchClass(html, "p", "cardDataProductsTxt")),
    rarity: textFromHtml(matchClass(html, "span", "rareData")),
    ruby,
    title: imgAlts(titleBlock)[0] ?? "",
    trigger: textFromHtml(matchClass(matchClass(html, "dl", "triggerData"), "dd", "cardDataContents")),
  };
}

async function loadCatalog() {
  try {
    return JSON.parse(await readFile(path.join(dataRoot, "catalog.json"), "utf8"));
  } catch {
    return { series: [] };
  }
}

async function saveCatalog(catalog) {
  catalog.syncedAt = new Date().toISOString();
  await mkdir(dataRoot, { recursive: true });
  await writeFile(path.join(dataRoot, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
}

async function persistData(data, productKey) {
  const dataPath = path.join(dataRoot, `${productKey}.json`);
  const publicDataPath = path.join(publicCardsRoot, productKey, "data.json");
  await mkdir(path.dirname(dataPath), { recursive: true });
  await mkdir(path.dirname(publicDataPath), { recursive: true });
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  await Promise.all([writeFile(dataPath, serialized), writeFile(publicDataPath, serialized)]);
  return dataPath;
}

function summaryFromData(data, productKey) {
  return {
    cardCount: data.cardCount,
    colors: data.colors || inferColors(data.cards),
    coverImage: data.cards?.[0]?.imageOfficialUrl || data.cards?.[0]?.image,
    dataFile: configuredDataRoot ? `${productKey}.json` : `data/cards/${productKey}.json`,
    dataUrl: `/cards/${productKey}/data.json`,
    officialListUrl: data.officialListUrl,
    productKey,
    productName: data.productName,
    seriesId: data.seriesId,
    setCode: data.setCode,
    ...(data.sourceSeriesId ? { sourceSeriesId: data.sourceSeriesId } : {}),
    syncedAt: data.syncedAt,
    workCode: data.workCode || inferWorkCode(data.cards),
  };
}

function resolveDataFile(dataFile = "") {
  if (configuredDataRoot) return path.join(dataRoot, path.basename(dataFile));
  return path.resolve(root, dataFile);
}

async function hasCompleteProductData(data, productKey) {
  try {
    await access(path.join(publicCardsRoot, productKey, "data.json"));
    return Boolean(data.cards?.length);
  } catch {
    return false;
  }
}

function sameCardList(cachedCards = [], officialCards = []) {
  const identity = (card) => `${card.cardNo}\u0000${card.imageFileName || ""}`;
  if (cachedCards.length !== officialCards.length) return false;
  const cached = cachedCards.map(identity).sort();
  const official = officialCards.map(identity).sort();
  return cached.every((value, index) => value === official[index]);
}

function isMixedCatalogEntry(item, seriesId) {
  return item.sourceSeriesId === seriesId || item.seriesId?.startsWith(`${seriesId}-`);
}

async function reuseCachedMixedSeries(catalog, seriesId, listHtml = null) {
  const cachedItems = catalog.series.filter((item) => isMixedCatalogEntry(item, seriesId));
  if (!cachedItems.length) return null;

  try {
    const loaded = [];
    for (const cached of cachedItems) {
      const data = JSON.parse(await readFile(resolveDataFile(cached.dataFile), "utf8"));
      if (!data.cards?.length || data.cards.length !== data.cardCount) return null;
      const workCode = data.workCode || inferWorkCode(data.cards);
      const { productKey } = mixedProductIdentity(seriesId, workCode);
      if (!(await hasCompleteProductData(data, productKey))) return null;
      loaded.push({ data, workCode });
    }
    if (listHtml) {
      const official = parseListPage(listHtml, seriesId);
      if (!sameCardList(loaded.flatMap(({ data }) => data.cards), official.cards)) return null;
    }

    const summaries = [];
    for (const { data, workCode } of loaded) {
      const { productKey, setCode } = mixedProductIdentity(seriesId, workCode);
      const normalized = {
        ...data,
        colors: data.colors || inferColors(data.cards),
        productKey,
        seriesId: `${seriesId}-${workCode}`,
        setCode,
        sourceSeriesId: seriesId,
        workCode,
      };
      await persistData(normalized, productKey);
      summaries.push(summaryFromData(normalized, productKey));
    }
    return summaries;
  } catch {
    return null;
  }
}

async function reuseCachedSeries(catalog, seriesId, listHtml = null) {
  const cached = catalog.series.find((item) => item.seriesId === seriesId);
  if (!cached?.dataFile) return null;
  try {
    const data = JSON.parse(await readFile(resolveDataFile(cached.dataFile), "utf8"));
    if (!data.cards?.length || data.cards.length !== data.cardCount) return null;
    if (listHtml && !sameCardList(data.cards, parseListPage(listHtml, seriesId).cards)) return null;
    const { productKey, setCode } = productIdentity(data.productName, data.cards[0], seriesId);
    if (!(await hasCompleteProductData(data, productKey))) return null;
    const normalized = {
      ...data,
      colors: data.colors || inferColors(data.cards),
      productKey,
      setCode,
      workCode: data.workCode || inferWorkCode(data.cards),
    };
    await persistData(normalized, productKey);
    return summaryFromData(normalized, productKey);
  } catch {
    return null;
  }
}

async function syncSeries(seriesId, prefetchedListHtml = null) {
  console.log(`\nFetching official card list for series ${seriesId}...`);
  const listUrl = `${OFFICIAL_ORIGIN}/jp/cardlist/?search=true&series=${encodeURIComponent(seriesId)}`;
  const listHtml = prefetchedListHtml ?? await fetchWithRetry(listUrl);
  const { cards: listCards, productName, resultCount } = parseListPage(listHtml, seriesId);
  const { productKey, setCode } = productIdentity(productName, listCards[0], seriesId);
  await mkdir(dataRoot, { recursive: true });

  let detailProgress = 0;
  const cards = await runPool(listCards, concurrency, async (card) => {
    try {
      const detailHtml = await fetchWithRetry(card.detailSourceUrl);
      return parseDetailPage(detailHtml, card);
    } catch (error) {
      console.warn(`Detail fallback for ${card.cardNo}: ${error.message}`);
      return card;
    } finally {
      detailProgress += 1;
      if (detailProgress % 20 === 0 || detailProgress === resultCount) {
        console.log(`  Details ${detailProgress}/${resultCount}`);
      }
    }
  });

  const syncedAt = new Date().toISOString();
  const normalizedCards = cards.map((card) => ({
    ...card,
    image: `/cards/${productKey}/${card.imageFileName}`,
  }));
  const workCode = inferWorkCode(normalizedCards);
  const data = {
    cardCount: normalizedCards.length,
    cards: normalizedCards,
    colors: inferColors(normalizedCards),
    officialListUrl: listUrl,
    productKey,
    productName,
    seriesId,
    setCode,
    syncedAt,
    workCode,
  };
  const dataPath = await persistData(data, productKey);
  console.log(`Saved ${normalizedCards.length} cards to ${path.relative(root, dataPath)}`);

  return summaryFromData(data, productKey);
}

async function syncMixedSeries(seriesId, prefetchedListHtml = null) {
  console.log(`\nFetching official mixed card list for series ${seriesId}...`);
  const listUrl = `${OFFICIAL_ORIGIN}/jp/cardlist/?search=true&series=${encodeURIComponent(seriesId)}`;
  const listHtml = prefetchedListHtml ?? await fetchWithRetry(listUrl);
  const { cards: listCards, productName, resultCount } = parseListPage(listHtml, seriesId);
  const groupedListCards = listCards.map((card) => ({
    ...card,
    workCode: workCodeFromCardNo(card.cardNo),
  }));

  let detailProgress = 0;
  const cards = await runPool(groupedListCards, concurrency, async (card) => {
    try {
      const detailHtml = await fetchWithRetry(card.detailSourceUrl);
      return parseDetailPage(detailHtml, card);
    } catch (error) {
      console.warn(`Detail fallback for ${card.cardNo}: ${error.message}`);
      return card;
    } finally {
      detailProgress += 1;
      if (detailProgress % 20 === 0 || detailProgress === resultCount) {
        console.log(`  Details ${detailProgress}/${resultCount}`);
      }
    }
  });

  const groups = new Map();
  for (const card of cards) {
    const workCode = card.workCode || workCodeFromCardNo(card.cardNo);
    const { productKey } = mixedProductIdentity(seriesId, workCode);
    const normalized = {
      ...card,
      image: `/cards/${productKey}/${card.imageFileName}`,
    };
    const group = groups.get(workCode) || [];
    group.push(normalized);
    groups.set(workCode, group);
  }

  const syncedAt = new Date().toISOString();
  const summaries = [];
  for (const [workCode, normalizedCards] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const { productKey, setCode } = mixedProductIdentity(seriesId, workCode);
    const data = {
      cardCount: normalizedCards.length,
      cards: normalizedCards,
      colors: inferColors(normalizedCards),
      officialListUrl: listUrl,
      productKey,
      productName,
      seriesId: `${seriesId}-${workCode}`,
      setCode,
      sourceSeriesId: seriesId,
      syncedAt,
      workCode,
    };
    const dataPath = await persistData(data, productKey);
    console.log(`Saved ${normalizedCards.length} ${workCode} cards to ${path.relative(root, dataPath)}`);
    summaries.push(summaryFromData(data, productKey));
  }

  return summaries;
}

const catalog = await loadCatalog();
const seriesIds = syncAll
  ? discoverSeriesIds(await fetchWithRetry(`${OFFICIAL_ORIGIN}/jp/cardlist/?search=true`))
  : requestedSeriesIds;

if (syncAll) {
  console.log(`Discovered ${seriesIds.length} official products, including promotion and limited-card pools.`);
}

const failures = [];
for (const seriesId of seriesIds) {
  try {
    const listUrl = `${OFFICIAL_ORIGIN}/jp/cardlist/?search=true&series=${encodeURIComponent(seriesId)}`;
    const prefetchedListHtml = refresh && !force ? await fetchWithRetry(listUrl) : null;
    if (MIXED_CARD_SERIES.has(seriesId)) {
      const cached = !force ? await reuseCachedMixedSeries(catalog, seriesId, prefetchedListHtml) : null;
      const summaries = cached || await syncMixedSeries(seriesId, prefetchedListHtml);
      if (cached) {
        console.log(`Using ${summaries.length} cached classified groups for mixed series ${seriesId}.`);
      }
      catalog.series = [
        ...catalog.series.filter((item) => !isMixedCatalogEntry(item, seriesId)),
        ...summaries,
      ];
      catalog.series.sort((a, b) => a.seriesId.localeCompare(b.seriesId));
      await saveCatalog(catalog);
      continue;
    }
    const cached = !force ? await reuseCachedSeries(catalog, seriesId, prefetchedListHtml) : null;
    const summary = cached || await syncSeries(seriesId, prefetchedListHtml);
    if (cached) console.log(`Using cached ${summary.setCode} (${summary.cardCount} cards).`);
    catalog.series = [...catalog.series.filter((item) => item.seriesId !== seriesId), summary];
    catalog.series.sort((a, b) => a.seriesId.localeCompare(b.seriesId));
    await saveCatalog(catalog);
  } catch (error) {
    failures.push({ error: error.message, seriesId });
    console.error(`Series ${seriesId} failed: ${error.message}`);
  }
}
await saveCatalog(catalog);
console.log(`Catalog sync complete: ${seriesIds.length - failures.length}/${seriesIds.length} products available.`);
if (failures.length) {
  console.error(`Failed series: ${failures.map((failure) => failure.seriesId).join(", ")}`);
  process.exitCode = 1;
}
