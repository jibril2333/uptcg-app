import { ensureStorageSchema, jsonResponse } from "@/db/storage";
import type { CollectionEntries, CollectionEntry } from "@/app/collection/collection-storage";

type CollectionRow = {
  card_json: string;
  card_key: string;
  count: number;
  updated_at: string;
  work_code: string;
  work_name: string;
};

function isCollectionEntry(value: unknown): value is CollectionEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<CollectionEntry>;
  return Boolean(entry.card && typeof entry.card === "object")
    && Number.isInteger(entry.count)
    && Number(entry.count) > 0
    && Number(entry.count) <= 99
    && typeof entry.updatedAt === "string"
    && typeof entry.workCode === "string"
    && typeof entry.workName === "string";
}

function upsertEntry(database: D1Database, key: string, entry: CollectionEntry) {
  return database.prepare(`INSERT INTO collection_cards
    (card_key, card_json, count, updated_at, work_code, work_name)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(card_key) DO UPDATE SET
      card_json = excluded.card_json,
      count = excluded.count,
      updated_at = excluded.updated_at,
      work_code = excluded.work_code,
      work_name = excluded.work_name`)
    .bind(key, JSON.stringify(entry.card), entry.count, entry.updatedAt, entry.workCode, entry.workName);
}

export async function GET() {
  try {
    const database = await ensureStorageSchema();
    const result = await database.prepare(`SELECT card_key, card_json, count, updated_at, work_code, work_name
      FROM collection_cards ORDER BY updated_at DESC`).all<CollectionRow>();
    const entries: CollectionEntries = {};
    for (const row of result.results) {
      try {
        entries[row.card_key] = {
          card: JSON.parse(row.card_json),
          count: row.count,
          updatedAt: row.updated_at,
          workCode: row.work_code,
          workName: row.work_name,
        };
      } catch {
        // Ignore a malformed legacy row without hiding the rest of the collection.
      }
    }
    return jsonResponse({ entries });
  } catch {
    return jsonResponse({ error: "database_unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return jsonResponse({ error: "json_required" }, { status: 415 });
    }
    const body = await request.json() as { entry?: unknown; key?: unknown };
    if (typeof body.key !== "string" || !body.key || body.key.length > 500) {
      return jsonResponse({ error: "invalid_key" }, { status: 400 });
    }
    const database = await ensureStorageSchema();
    if (body.entry === null) {
      await database.prepare("DELETE FROM collection_cards WHERE card_key = ?").bind(body.key).run();
    } else if (isCollectionEntry(body.entry)) {
      await upsertEntry(database, body.key, body.entry).run();
    } else {
      return jsonResponse({ error: "invalid_entry" }, { status: 400 });
    }
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "database_write_failed" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return jsonResponse({ error: "json_required" }, { status: 415 });
    }
    const body = await request.json() as { entries?: unknown };
    if (!body.entries || typeof body.entries !== "object" || Array.isArray(body.entries)) {
      return jsonResponse({ error: "invalid_entries" }, { status: 400 });
    }
    const entries = Object.entries(body.entries as Record<string, unknown>);
    if (entries.length > 10_000 || entries.some(([key, entry]) => !key || key.length > 500 || !isCollectionEntry(entry))) {
      return jsonResponse({ error: "invalid_entries" }, { status: 400 });
    }
    const database = await ensureStorageSchema();
    for (let index = 0; index < entries.length; index += 40) {
      const statements = entries.slice(index, index + 40).map(([key, entry]) => upsertEntry(database, key, entry as CollectionEntry));
      if (statements.length) await database.batch(statements);
    }
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "database_write_failed" }, { status: 503 });
  }
}
