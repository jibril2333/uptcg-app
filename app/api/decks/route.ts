import { ensureStorageSchema, jsonResponse } from "@/db/storage";
import type { SavedDeck } from "@/app/decks/deck-storage";

type DeckRow = {
  cards_json: string;
  color: string;
  id: string;
  name: string;
  series_code: string;
  series_name: string;
  updated_at: string;
};

function isSavedDeck(value: unknown): value is SavedDeck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<SavedDeck>;
  return typeof deck.id === "string"
    && typeof deck.name === "string"
    && typeof deck.seriesCode === "string"
    && typeof deck.seriesName === "string"
    && typeof deck.updatedAt === "string"
    && Array.isArray(deck.cards);
}

export async function GET() {
  try {
    const database = await ensureStorageSchema();
    const result = await database.prepare(`SELECT id, name, series_code, series_name, color, cards_json, updated_at
      FROM decks ORDER BY updated_at DESC`).all<DeckRow>();
    const decks = result.results.flatMap((row) => {
      try {
        const cards = JSON.parse(row.cards_json);
        if (!Array.isArray(cards)) return [];
        return [{
          id: row.id,
          name: row.name,
          seriesCode: row.series_code,
          seriesName: row.series_name,
          color: row.color || undefined,
          cards,
          updatedAt: row.updated_at,
        } satisfies SavedDeck];
      } catch {
        return [];
      }
    });
    return jsonResponse({ decks });
  } catch {
    return jsonResponse({ error: "database_unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return jsonResponse({ error: "json_required" }, { status: 415 });
    }
    const body = await request.json() as { decks?: unknown };
    if (!Array.isArray(body.decks) || body.decks.length > 100 || !body.decks.every(isSavedDeck)) {
      return jsonResponse({ error: "invalid_decks" }, { status: 400 });
    }
    const database = await ensureStorageSchema();
    await database.batch([
      database.prepare("DELETE FROM decks"),
      ...body.decks.map((deck) => database.prepare(`INSERT INTO decks
        (id, name, series_code, series_name, color, cards_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(deck.id, deck.name, deck.seriesCode, deck.seriesName, deck.color || "", JSON.stringify(deck.cards), deck.updatedAt)),
    ]);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "database_write_failed" }, { status: 503 });
  }
}
