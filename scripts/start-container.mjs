import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cardDataRoot = path.resolve(process.env.UPTCG_CARD_DATA_DIR || "/data/card-data");
const cardAssetRoot = path.resolve(process.env.UPTCG_CARD_ASSET_DIR || "/data/card-assets");
const completionMarker = path.join(cardDataRoot, ".sync-complete.json");
const catalogPath = path.join(cardDataRoot, "catalog.json");

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  }));
}

async function readCatalog() {
  try {
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
    return Array.isArray(catalog.series) && catalog.series.length ? catalog : null;
  } catch {
    return null;
  }
}

function productDataPath(product) {
  return path.join(cardDataRoot, path.basename(product.dataFile || `${product.productKey}.json`));
}

async function validateProduct(product) {
  const data = JSON.parse(await readFile(productDataPath(product), "utf8"));
  if (!Array.isArray(data.cards) || !data.cards.length || data.cards.length !== product.cardCount) {
    return false;
  }

  await access(path.join(cardAssetRoot, product.productKey, "data.json"));
  return true;
}

async function validateCardStore({ full }) {
  const catalog = await readCatalog();
  if (!catalog) return null;

  try {
    const products = full
      ? catalog.series
      : [catalog.series[0], catalog.series.at(-1)].filter(Boolean);
    await runPool(products, full ? 8 : 2, (product) => validateProduct(product));
    return catalog;
  } catch {
    return null;
  }
}

async function hasCompletionMarker() {
  try {
    await access(completionMarker);
    return true;
  } catch {
    return false;
  }
}

async function markComplete(catalog) {
  await writeFile(completionMarker, `${JSON.stringify({
    completedAt: new Date().toISOString(),
    productCount: catalog.series.length,
    syncedAt: catalog.syncedAt || null,
  }, null, 2)}\n`);
}

function runSync() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/sync-ua-cards.mjs", "--all"], {
      cwd: root,
      env: {
        ...process.env,
        UPTCG_CARD_ASSET_DIR: cardAssetRoot,
        UPTCG_CARD_DATA_DIR: cardDataRoot,
      },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Official card sync exited with ${signal || `status ${code}`}`));
    });
  });
}

await Promise.all([
  mkdir(cardDataRoot, { recursive: true }),
  mkdir(cardAssetRoot, { recursive: true }),
]);

let catalog = null;
if (await hasCompletionMarker()) {
  catalog = await validateCardStore({ full: false });
}

if (!catalog) {
  console.log("No complete card store found. Downloading card data from the UNION ARENA official site.");
  console.log("The first startup can take a while. Progress will be shown in these container logs.");
  await runSync();
  catalog = await validateCardStore({ full: true });
  if (!catalog) throw new Error("Official card sync finished but the local card store is incomplete.");
  await markComplete(catalog);
  console.log(`Official card sync complete (${catalog.series.length} products).`);
}

await import("./serve-local.mjs");
