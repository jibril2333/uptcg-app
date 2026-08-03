import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_SCHEDULE_TIME = "04:00";
const ALLOWED_INTERVAL_HOURS = new Set([6, 12, 24, 48, 168]);
const TOKYO_OFFSET_MS = 9 * 60 * 60 * 1000;
const UPDATE_STATE_FILE = "update-settings.json";

function isoDate(value) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function normalizedState(value = {}) {
  const candidateInterval = Number(value.intervalHours);
  const intervalHours = ALLOWED_INTERVAL_HOURS.has(candidateInterval)
    ? candidateInterval
    : DEFAULT_INTERVAL_HOURS;
  const scheduleTime = typeof value.scheduleTime === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.scheduleTime)
    ? value.scheduleTime
    : DEFAULT_SCHEDULE_TIME;
  return {
    autoUpdate: value.autoUpdate === true,
    intervalHours,
    lastError: typeof value.lastError === "string" ? value.lastError.slice(0, 500) : null,
    lastStartedAt: isoDate(value.lastStartedAt),
    lastSuccessAt: isoDate(value.lastSuccessAt),
    nextCheckAt: isoDate(value.nextCheckAt),
    scheduleTime,
  };
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, filePath);
}

function nextScheduledAt(date, intervalHours, scheduleTime) {
  const [hours, minutes] = scheduleTime.split(":").map(Number);
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const localNow = date.getTime() + TOKYO_OFFSET_MS;
  const localDayStart = Math.floor(localNow / 86_400_000) * 86_400_000;
  const localAnchor = localDayStart + hours * 60 * 60 * 1000 + minutes * 60 * 1000;
  let localNext = localAnchor;

  if (intervalHours < 24 && localNext <= localNow) {
    localNext += (Math.floor((localNow - localNext) / intervalMs) + 1) * intervalMs;
  } else if (intervalHours >= 24 && localNext <= localNow) {
    localNext += intervalMs;
  }

  return new Date(localNext - TOKYO_OFFSET_MS).toISOString();
}

function catalogStatus(catalog = {}) {
  const products = Array.isArray(catalog.series) ? catalog.series : [];
  return {
    cardCount: products.reduce((total, product) => total + (Number(product.cardCount) || 0), 0),
    productCount: products.length,
    syncedAt: isoDate(catalog.syncedAt),
    workCount: new Set(products.map((product) => product.workCode).filter(Boolean)).size,
  };
}

function runOfficialSync({ cardAssetRoot, cardDataRoot, root }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "scripts/sync-ua-cards.mjs"), "--all", "--refresh"], {
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
      else reject(new Error(`卡牌同步程序异常结束（${signal || `exit ${code}`}）`));
    });
  });
}

export function createCardUpdateManager({
  cardAssetRoot,
  cardDataRoot,
  getCatalog,
  now = () => new Date(),
  notify = async () => {},
  onCatalogUpdated = () => {},
  root,
  runSync = runOfficialSync,
  scheduler = true,
}) {
  const statePath = path.join(cardDataRoot, UPDATE_STATE_FILE);
  let state = normalizedState();
  let running = false;
  let currentSource = null;
  let updatePromise = Promise.resolve();
  let intervalHandle;
  let startupHandle;

  async function saveState() {
    await writeJsonAtomic(statePath, state);
  }

  async function readState() {
    try {
      state = normalizedState(JSON.parse(await readFile(statePath, "utf8")));
    } catch {
      state = normalizedState();
      await saveState();
    }
  }

  function status() {
    return {
      ...state,
      catalog: catalogStatus(getCatalog()),
      isRunning: running,
      source: currentSource,
    };
  }

  function isDue() {
    return state.autoUpdate
      && (!state.nextCheckAt || Date.parse(state.nextCheckAt) <= now().getTime());
  }

  function startUpdate(source = "manual") {
    if (running) return false;
    running = true;
    currentSource = source;
    state.lastStartedAt = now().toISOString();
    state.lastError = null;

    updatePromise = (async () => {
      try {
        await saveState();
        const previousCatalog = catalogStatus(getCatalog());
        await runSync({ cardAssetRoot, cardDataRoot, root, source });
        const catalog = JSON.parse(await readFile(path.join(cardDataRoot, "catalog.json"), "utf8"));
        if (!Array.isArray(catalog.series)) throw new Error("更新后的卡表目录格式不正确");
        const nextCatalog = catalogStatus(catalog);
        onCatalogUpdated(catalog);
        state.lastSuccessAt = now().toISOString();
        state.lastError = null;
        await writeJsonAtomic(path.join(cardDataRoot, ".sync-complete.json"), {
          productCount: catalog.series.length,
          syncedAt: state.lastSuccessAt,
        });
        const addedCardCount = Math.max(0, nextCatalog.cardCount - previousCatalog.cardCount);
        if (addedCardCount > 0) {
          try {
            await notify({ status: "success", addedCardCount, catalog: nextCatalog, source });
          } catch (error) {
            console.error(`ntfy notification failed: ${error instanceof Error ? error.message : error}`);
          }
        }
      } catch (error) {
        state.lastError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        try {
          await notify({ status: "failure", error: state.lastError, source });
        } catch (notificationError) {
          console.error(`ntfy notification failed: ${notificationError instanceof Error ? notificationError.message : notificationError}`);
        }
      } finally {
        running = false;
        currentSource = null;
        state.nextCheckAt = state.autoUpdate
          ? nextScheduledAt(now(), state.intervalHours, state.scheduleTime)
          : null;
        await saveState();
      }
    })();
    return true;
  }

  async function setAutoUpdate(value) {
    const configuration = typeof value === "boolean" ? { enabled: value } : value || {};
    state = normalizedState({
      ...state,
      autoUpdate: configuration.enabled === true,
      intervalHours: configuration.intervalHours ?? state.intervalHours,
      scheduleTime: configuration.scheduleTime ?? state.scheduleTime,
    });
    state.nextCheckAt = state.autoUpdate
      ? nextScheduledAt(now(), state.intervalHours, state.scheduleTime)
      : null;
    await saveState();
    return status();
  }

  async function initialize() {
    await readState();
    if (!scheduler) return;
    intervalHandle = setInterval(() => {
      if (isDue()) startUpdate("automatic");
    }, 60_000);
    intervalHandle.unref?.();
    if (isDue()) {
      startupHandle = setTimeout(() => startUpdate("automatic"), 15_000);
      startupHandle.unref?.();
    }
  }

  function close() {
    if (intervalHandle) clearInterval(intervalHandle);
    if (startupHandle) clearTimeout(startupHandle);
  }

  return {
    close,
    initialize,
    setAutoUpdate,
    startUpdate,
    status,
    waitForIdle: () => updatePromise,
  };
}
