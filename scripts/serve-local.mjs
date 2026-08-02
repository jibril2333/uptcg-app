import { createServer } from "node:http";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCardUpdateManager } from "./card-update-manager.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const clientRoot = path.join(root, "dist/client");
const workerPath = path.join(root, "dist/server/index.js");
const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOST || "0.0.0.0";
const cardDataRoot = path.resolve(process.env.UPTCG_CARD_DATA_DIR || "/data/card-data");
const cardAssetRoot = path.resolve(process.env.UPTCG_CARD_ASSET_DIR || "/data/card-assets");

async function databasePath() {
  if (process.env.UPTCG_DB_PATH) return path.resolve(process.env.UPTCG_DB_PATH);

  const miniflareDirectory = path.join(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  try {
    const candidates = (await readdir(miniflareDirectory))
      .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite")
      .sort();
    if (candidates.length) return path.join(miniflareDirectory, candidates[0]);
  } catch {
    // A new Docker volume will not have a Miniflare database yet.
  }

  const fallback = path.join(root, ".wrangler/uptcg.sqlite");
  await mkdir(path.dirname(fallback), { recursive: true });
  return fallback;
}

class LocalD1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new LocalD1Statement(this.database, this.sql, values);
  }

  async all() {
    return {
      meta: {},
      results: this.database.prepare(this.sql).all(...this.values),
      success: true,
    };
  }

  async first(column) {
    const row = this.database.prepare(this.sql).get(...this.values) ?? null;
    return column && row ? row[column] ?? null : row;
  }

  async raw() {
    const statement = this.database.prepare(this.sql);
    const columns = statement.columns().map((column) => column.name);
    return [columns, ...statement.all(...this.values).map((row) => columns.map((column) => row[column]))];
  }

  async run() {
    return this.runSync();
  }

  runSync() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return {
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid || 0),
      },
      success: true,
    };
  }
}

function createD1Database(database) {
  return {
    prepare(sql) {
      return new LocalD1Statement(database, sql);
    },
    async batch(statements) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.runSync());
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(sql) {
      database.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
}

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

async function fetchAsset(request) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const isCardAsset = pathname.startsWith("/cards/");
  const assetRoot = isCardAsset ? cardAssetRoot : clientRoot;
  const relativePath = isCardAsset
    ? pathname.slice("/cards/".length)
    : pathname.replace(/^\/+/, "");
  const filePath = path.resolve(assetRoot, relativePath);
  if (filePath !== assetRoot && !filePath.startsWith(`${assetRoot}${path.sep}`)) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("Not Found", { status: 404 });
    const headers = new Headers({
      "content-length": String(info.size),
      "content-type": contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
    });
    if (pathname.startsWith("/assets/")) headers.set("cache-control", "public, max-age=31536000, immutable");
    if (isCardAsset && path.extname(filePath).toLowerCase() !== ".json") {
      headers.set("cache-control", "public, max-age=86400");
    }
    if (isCardAsset && path.extname(filePath).toLowerCase() === ".json") {
      headers.set("cache-control", "no-cache");
    }
    return new Response(request.method === "HEAD" ? null : await readFile(filePath), { headers });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

const sqlitePath = await databasePath();
const sqlite = new DatabaseSync(sqlitePath);
sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
const d1 = createD1Database(sqlite);
globalThis.__UPTCG_DB__ = d1;
globalThis.__UPTCG_CARD_CATALOG__ = JSON.parse(
  await readFile(path.join(cardDataRoot, "catalog.json"), "utf8"),
);

const cardUpdateManager = createCardUpdateManager({
  cardAssetRoot,
  cardDataRoot,
  getCatalog: () => globalThis.__UPTCG_CARD_CATALOG__,
  onCatalogUpdated: (catalog) => {
    globalThis.__UPTCG_CARD_CATALOG__ = catalog;
  },
  root,
});
await cardUpdateManager.initialize();

const { default: worker } = await import(pathToFileURL(workerPath).href);

async function sendResponse(incoming, outgoing, response) {
  outgoing.statusCode = response.status;
  outgoing.statusMessage = response.statusText;
  response.headers.forEach((value, name) => outgoing.setHeader(name, value));
  outgoing.end(incoming.method === "HEAD" ? undefined : Buffer.from(await response.arrayBuffer()));
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
    status,
  });
}

async function cardUpdateResponse(request) {
  if (["GET", "HEAD"].includes(request.method)) return jsonResponse(cardUpdateManager.status());
  if (!["POST", "PUT"].includes(request.method)) {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ error: "json_required" }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (request.method === "PUT") {
    if (typeof body?.enabled !== "boolean") return jsonResponse({ error: "enabled_required" }, 400);
    return jsonResponse(await cardUpdateManager.setAutoUpdate(body.enabled));
  }

  const started = cardUpdateManager.startUpdate("manual");
  return jsonResponse(cardUpdateManager.status(), started ? 202 : 409);
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://${incoming.headers.host || `localhost:${port}`}`;
    const init = {
      body: ["GET", "HEAD"].includes(incoming.method || "GET") ? undefined : Readable.toWeb(incoming),
      duplex: "half",
      headers: incoming.headers,
      method: incoming.method,
    };
    const request = new Request(new URL(incoming.url || "/", origin), init);
    if (new URL(request.url).pathname === "/api/card-update") {
      await sendResponse(incoming, outgoing, await cardUpdateResponse(request));
      return;
    }
    if (["GET", "HEAD"].includes(incoming.method || "GET")) {
      const assetResponse = await fetchAsset(request);
      if (assetResponse.status !== 404) {
        await sendResponse(incoming, outgoing, assetResponse);
        return;
      }
    }

    const pending = [];
    const response = await worker.fetch(request, {
      ASSETS: { fetch: fetchAsset },
      DB: d1,
    }, {
      passThroughOnException() {},
      waitUntil(promise) { pending.push(Promise.resolve(promise)); },
    });

    await sendResponse(incoming, outgoing, response);
    if (pending.length) void Promise.allSettled(pending);
  } catch (error) {
    console.error(error);
    if (!outgoing.headersSent) {
      outgoing.statusCode = 500;
      outgoing.setHeader("content-type", "text/plain; charset=utf-8");
    }
    outgoing.end("Internal Server Error");
  }
});

server.listen(port, hostname, () => {
  console.log(`UPTCG local server listening on http://${hostname}:${port}`);
  console.log(`SQLite database: ${sqlitePath}`);
  console.log(`Card data: ${cardDataRoot}`);
  console.log(`Card images: ${cardAssetRoot}`);
});

function close() {
  cardUpdateManager.close();
  server.close(() => {
    sqlite.close();
    process.exit(0);
  });
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
