import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createCardUpdateManager } from "../scripts/card-update-manager.mjs";

test("card updater persists automatic checks and hot-loads newly discovered works", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "uptcg-card-update-"));
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const cardDataRoot = path.join(temporaryRoot, "card-data");
  const cardAssetRoot = path.join(temporaryRoot, "card-assets");
  await Promise.all([
    mkdir(cardDataRoot, { recursive: true }),
    mkdir(cardAssetRoot, { recursive: true }),
  ]);

  let currentTime = new Date("2026-08-02T00:00:00.000Z");
  let catalog = {
    series: [{ cardCount: 1, productKey: "ua01bt", workCode: "OLD" }],
    syncedAt: currentTime.toISOString(),
  };
  const notifications = [];
  await writeFile(path.join(cardDataRoot, "catalog.json"), JSON.stringify(catalog));

  const manager = createCardUpdateManager({
    cardAssetRoot,
    cardDataRoot,
    getCatalog: () => catalog,
    now: () => currentTime,
    notify: async (event) => { notifications.push(event); },
    onCatalogUpdated: (next) => { catalog = next; },
    root: temporaryRoot,
    runSync: async () => {
      currentTime = new Date("2026-08-02T00:10:00.000Z");
      await writeFile(path.join(cardDataRoot, "catalog.json"), JSON.stringify({
        series: [
          { cardCount: 1, productKey: "ua01bt", workCode: "OLD" },
          { cardCount: 3, productKey: "ua60bt", workCode: "NEW" },
        ],
        syncedAt: currentTime.toISOString(),
      }));
    },
    scheduler: false,
  });
  await manager.initialize();

  const automatic = await manager.setAutoUpdate(true);
  assert.equal(automatic.autoUpdate, true);
  assert.equal(automatic.nextCheckAt, "2026-08-03T00:00:00.000Z");
  assert.equal(manager.startUpdate("manual"), true);
  assert.equal(manager.startUpdate("manual"), false, "a second sync cannot run concurrently");
  await manager.waitForIdle();

  const status = manager.status();
  assert.equal(status.isRunning, false);
  assert.equal(status.lastSuccessAt, "2026-08-02T00:10:00.000Z");
  assert.equal(status.nextCheckAt, "2026-08-03T00:10:00.000Z");
  assert.deepEqual(status.catalog, {
    cardCount: 4,
    productCount: 2,
    syncedAt: "2026-08-02T00:10:00.000Z",
    workCount: 2,
  });
  assert.equal(catalog.series[1].workCode, "NEW");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].status, "success");
  assert.equal(notifications[0].catalog.cardCount, 4);

  const savedSettings = JSON.parse(await readFile(path.join(cardDataRoot, "update-settings.json"), "utf8"));
  assert.equal(savedSettings.autoUpdate, true);
  const completion = JSON.parse(await readFile(path.join(cardDataRoot, ".sync-complete.json"), "utf8"));
  assert.equal(completion.productCount, 2);
  manager.close();
});

test("card updater reports failure without replacing the existing catalog", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "uptcg-card-update-failure-"));
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }));
  const cardDataRoot = path.join(temporaryRoot, "card-data");
  await mkdir(cardDataRoot, { recursive: true });
  const catalog = { series: [{ cardCount: 2, productKey: "safe", workCode: "SAFE" }] };
  const notifications = [];
  await writeFile(path.join(cardDataRoot, "catalog.json"), JSON.stringify(catalog));

  const manager = createCardUpdateManager({
    cardAssetRoot: path.join(temporaryRoot, "card-assets"),
    cardDataRoot,
    getCatalog: () => catalog,
    notify: async (event) => { notifications.push(event); },
    root: temporaryRoot,
    runSync: async () => { throw new Error("official site unavailable"); },
    scheduler: false,
  });
  await manager.initialize();
  assert.equal(manager.startUpdate(), true);
  await manager.waitForIdle();
  assert.match(manager.status().lastError, /official site unavailable/);
  assert.equal(manager.status().catalog.cardCount, 2);
  assert.equal(notifications[0].status, "failure");
  assert.match(notifications[0].error, /official site unavailable/);
  manager.close();
});
