let schemaReady: Promise<void> | undefined;

export async function getStorageDatabase(): Promise<D1Database> {
  const localDatabase = (globalThis as typeof globalThis & { __UPTCG_DB__?: D1Database }).__UPTCG_DB__;
  if (localDatabase) return localDatabase;
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }
  return env.DB;
}

export async function ensureStorageSchema(database?: D1Database) {
  const activeDatabase = database ?? await getStorageDatabase();
  if (!schemaReady) {
    schemaReady = activeDatabase.batch([
      activeDatabase.prepare(`CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        series_code TEXT NOT NULL,
        series_name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '',
        cards_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      activeDatabase.prepare(`CREATE TABLE IF NOT EXISTS collection_cards (
        card_key TEXT PRIMARY KEY NOT NULL,
        card_json TEXT NOT NULL,
        count INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        work_code TEXT NOT NULL,
        work_name TEXT NOT NULL
      )`),
      activeDatabase.prepare(`CREATE TABLE IF NOT EXISTS pinned_series (
        code TEXT PRIMARY KEY NOT NULL,
        position INTEGER NOT NULL
      )`),
    ]).then(() => undefined).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
  return activeDatabase;
}

export function jsonResponse(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(value), { ...init, headers });
}
