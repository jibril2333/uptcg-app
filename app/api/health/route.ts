import { getStorageDatabase, jsonResponse } from "@/db/storage";

const version = process.env.UPTCG_GIT_SHA || "development";

export async function GET() {
  try {
    const database = await getStorageDatabase();
    await database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' LIMIT 1").first();

    const catalog = globalThis.__UPTCG_CARD_CATALOG__;
    if (!Array.isArray(catalog?.series) || catalog.series.length === 0) {
      throw new Error("card_catalog_unavailable");
    }

    return jsonResponse({
      ok: true,
      productCount: catalog.series.length,
      version,
    });
  } catch {
    return jsonResponse({ ok: false, version }, { status: 503 });
  }
}
