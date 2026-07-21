const PINNED_SERIES_KEY = "uptcg-pinned-series-v1";
const PINNED_MIGRATION_KEY = "uptcg-db-pinned-series-migrated-v1";

function loadCachedPinnedCodes() {
  try {
    const value = JSON.parse(window.localStorage.getItem(PINNED_SERIES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((code): code is string => typeof code === "string") : [];
  } catch {
    return [];
  }
}

function cachePinnedCodes(codes: string[]) {
  window.localStorage.setItem(PINNED_SERIES_KEY, JSON.stringify(codes));
}

async function fetchPinnedCodes() {
  const response = await fetch("/api/pinned-series", { cache: "no-store" });
  if (!response.ok) throw new Error("database_read_failed");
  const value = await response.json() as { codes?: string[] };
  return Array.isArray(value.codes) ? value.codes.filter((code): code is string => typeof code === "string") : [];
}

async function writePinnedCodes(codes: string[]) {
  const response = await fetch("/api/pinned-series", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ codes }),
  });
  if (!response.ok) throw new Error("database_write_failed");
}

async function loadPinnedCodesOnce(validCodes: Set<string>, maximum: number) {
  const cached = loadCachedPinnedCodes().filter((code) => validCodes.has(code)).slice(0, maximum);
  try {
    const databaseCodes = (await fetchPinnedCodes()).filter((code) => validCodes.has(code)).slice(0, maximum);
    if (window.localStorage.getItem(PINNED_MIGRATION_KEY) !== "1") {
      const merged = [...databaseCodes, ...cached.filter((code) => !databaseCodes.includes(code))].slice(0, maximum);
      if (cached.length) await writePinnedCodes(merged);
      cachePinnedCodes(merged);
      window.localStorage.setItem(PINNED_MIGRATION_KEY, "1");
      return merged;
    }
    cachePinnedCodes(databaseCodes);
    return databaseCodes;
  } catch {
    return cached;
  }
}

let pinnedLoadPromise: Promise<string[]> | undefined;

export function loadPinnedCodes(validCodes: Set<string>, maximum: number) {
  pinnedLoadPromise ??= loadPinnedCodesOnce(validCodes, maximum).finally(() => { pinnedLoadPromise = undefined; });
  return pinnedLoadPromise;
}

export async function storePinnedCodes(codes: string[]) {
  await writePinnedCodes(codes);
  cachePinnedCodes(codes);
  window.localStorage.setItem(PINNED_MIGRATION_KEY, "1");
}
