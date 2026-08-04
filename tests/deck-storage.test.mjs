import assert from "node:assert/strict";
import test from "node:test";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function sampleDeck(overrides = {}) {
  return {
    cards: [],
    color: "red",
    id: "deck-1",
    name: "旧浏览器牌组",
    seriesCode: "EVA",
    seriesName: "新世紀福音戰士",
    updatedAt: "2026-07-15T10:00:00.000Z",
    ...overrides,
  };
}

test("recovers cached decks even when the old migration marker is already set", async () => {
  const cachedDeck = sampleDeck();
  const storage = memoryStorage({
    "uptcg-local-decks-v1": JSON.stringify([cachedDeck]),
    "uptcg-db-decks-migrated-v1": "1",
  });
  const writes = [];

  globalThis.window = { localStorage: storage };
  globalThis.fetch = async (_url, init = {}) => {
    if (init.method === "PUT") {
      writes.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ decks: [] }), { status: 200 });
  };

  const deckStorage = await import(`../app/decks/deck-storage.ts?recovery=${Date.now()}`);
  const decks = await deckStorage.loadDecks();

  assert.deepEqual(decks, [cachedDeck]);
  assert.deepEqual(writes, [{ decks: [cachedDeck] }]);
  assert.equal(storage.getItem("uptcg-db-decks-recovered-v2"), "1");
});

test("keeps the newest copy when cached and database decks share an id", async () => {
  const cachedDeck = sampleDeck();
  const databaseDeck = sampleDeck({
    name: "数据库中的新版牌组",
    updatedAt: "2026-07-16T10:00:00.000Z",
  });
  const storage = memoryStorage({
    "uptcg-local-decks-v1": JSON.stringify([cachedDeck]),
  });
  const writes = [];

  globalThis.window = { localStorage: storage };
  globalThis.fetch = async (_url, init = {}) => {
    if (init.method === "PUT") {
      writes.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ decks: [databaseDeck] }), { status: 200 });
  };

  const deckStorage = await import(`../app/decks/deck-storage.ts?newer=${Date.now()}`);
  const decks = await deckStorage.loadDecks();

  assert.deepEqual(decks, [databaseDeck]);
  assert.deepEqual(writes, []);
});
