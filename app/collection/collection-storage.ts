import type { UaCard } from "../cards/CardCatalog";

export const COLLECTION_STORAGE_KEY = "uptcg-local-collection-v1";
const COLLECTION_MIGRATION_KEY = "uptcg-db-collection-migrated-v1";

export type CollectionEntry = {
  card: UaCard;
  count: number;
  updatedAt: string;
  workCode: string;
  workName: string;
};

export type CollectionEntries = Record<string, CollectionEntry>;

function loadCachedCollection(): CollectionEntries {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(COLLECTION_STORAGE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function cacheCollection(entries: CollectionEntries) {
  window.localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(entries));
}

function mergeCollection(databaseEntries: CollectionEntries, localEntries: CollectionEntries) {
  const merged = { ...databaseEntries };
  for (const [key, entry] of Object.entries(localEntries)) {
    const current = merged[key];
    if (!current || Date.parse(entry.updatedAt) >= Date.parse(current.updatedAt)) merged[key] = entry;
  }
  return merged;
}

async function fetchCollection() {
  const response = await fetch("/api/collection", { cache: "no-store" });
  if (!response.ok) throw new Error("database_read_failed");
  const value = await response.json() as { entries?: CollectionEntries };
  return value.entries && typeof value.entries === "object" && !Array.isArray(value.entries) ? value.entries : {};
}

async function migrateCollection(entries: CollectionEntries) {
  const response = await fetch("/api/collection", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  if (!response.ok) throw new Error("database_write_failed");
}

let collectionWriteQueue = Promise.resolve();

async function loadCollectionOnce(): Promise<CollectionEntries> {
  if (typeof window === "undefined") return {};
  const cached = loadCachedCollection();
  try {
    const databaseEntries = await fetchCollection();
    if (window.localStorage.getItem(COLLECTION_MIGRATION_KEY) !== "1") {
      const merged = mergeCollection(databaseEntries, cached);
      if (Object.keys(cached).length) await migrateCollection(merged);
      cacheCollection(merged);
      window.localStorage.setItem(COLLECTION_MIGRATION_KEY, "1");
      return merged;
    }
    cacheCollection(databaseEntries);
    return databaseEntries;
  } catch {
    return cached;
  }
}

let collectionLoadPromise: Promise<CollectionEntries> | undefined;

export function loadCollection(): Promise<CollectionEntries> {
  collectionLoadPromise ??= loadCollectionOnce().finally(() => { collectionLoadPromise = undefined; });
  return collectionLoadPromise;
}

export function storeCollectionEntry(key: string, entry: CollectionEntry | null, entries: CollectionEntries) {
  cacheCollection(entries);
  collectionWriteQueue = collectionWriteQueue.catch(() => undefined).then(async () => {
    const response = await fetch("/api/collection", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, entry }),
    });
    if (!response.ok) throw new Error("database_write_failed");
    window.localStorage.setItem(COLLECTION_MIGRATION_KEY, "1");
  });
  return collectionWriteQueue;
}

export async function storeCollectionEntries(entries: CollectionEntries) {
  await migrateCollection(entries);
  cacheCollection(entries);
  window.localStorage.setItem(COLLECTION_MIGRATION_KEY, "1");
}
