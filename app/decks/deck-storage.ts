import type { UaCard } from "../cards/CardCatalog";

export const DECK_STORAGE_KEY = "uptcg-local-decks-v1";
const DECK_MIGRATION_KEY = "uptcg-db-decks-migrated-v1";

export type SavedDeckCard = {
  card: UaCard;
  count: number;
};

export type SavedDeck = {
  cards: SavedDeckCard[];
  color?: string;
  id: string;
  name: string;
  seriesCode: string;
  seriesName: string;
  updatedAt: string;
};

function loadCachedDecks(): SavedDeck[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(DECK_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function cacheDecks(decks: SavedDeck[]) {
  window.localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(decks));
}

function mergeDecks(databaseDecks: SavedDeck[], localDecks: SavedDeck[]) {
  const merged = new Map<string, SavedDeck>();
  for (const deck of [...databaseDecks, ...localDecks]) {
    const current = merged.get(deck.id);
    if (!current || Date.parse(deck.updatedAt) >= Date.parse(current.updatedAt)) merged.set(deck.id, deck);
  }
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function fetchDecks() {
  const response = await fetch("/api/decks", { cache: "no-store" });
  if (!response.ok) throw new Error("database_read_failed");
  const value = await response.json() as { decks?: SavedDeck[] };
  return Array.isArray(value.decks) ? value.decks : [];
}

async function writeDecks(decks: SavedDeck[]) {
  const response = await fetch("/api/decks", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decks }),
  });
  if (!response.ok) throw new Error("database_write_failed");
}

async function loadDecksOnce(): Promise<SavedDeck[]> {
  if (typeof window === "undefined") return [];
  const cached = loadCachedDecks();
  try {
    const databaseDecks = await fetchDecks();
    if (window.localStorage.getItem(DECK_MIGRATION_KEY) !== "1") {
      const merged = mergeDecks(databaseDecks, cached);
      if (cached.length) await writeDecks(merged);
      cacheDecks(merged);
      window.localStorage.setItem(DECK_MIGRATION_KEY, "1");
      return merged;
    }
    cacheDecks(databaseDecks);
    return databaseDecks;
  } catch {
    return cached;
  }
}

let deckLoadPromise: Promise<SavedDeck[]> | undefined;

export function loadDecks(): Promise<SavedDeck[]> {
  deckLoadPromise ??= loadDecksOnce().finally(() => { deckLoadPromise = undefined; });
  return deckLoadPromise;
}

export async function storeDecks(decks: SavedDeck[]) {
  await writeDecks(decks);
  cacheDecks(decks);
  window.localStorage.setItem(DECK_MIGRATION_KEY, "1");
}

export function deckCardCount(deck: SavedDeck) {
  return deck.cards.reduce((total, item) => total + item.count, 0);
}
