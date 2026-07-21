import { ensureStorageSchema, jsonResponse } from "@/db/storage";

type PinnedRow = { code: string };

export async function GET() {
  try {
    const database = await ensureStorageSchema();
    const result = await database.prepare("SELECT code FROM pinned_series ORDER BY position ASC").all<PinnedRow>();
    return jsonResponse({ codes: result.results.map((row) => row.code) });
  } catch {
    return jsonResponse({ error: "database_unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return jsonResponse({ error: "json_required" }, { status: 415 });
    }
    const body = await request.json() as { codes?: unknown };
    if (!Array.isArray(body.codes)
      || body.codes.length > 10
      || body.codes.some((code) => typeof code !== "string" || !code || code.length > 30)
      || new Set(body.codes).size !== body.codes.length) {
      return jsonResponse({ error: "invalid_codes" }, { status: 400 });
    }
    const database = await ensureStorageSchema();
    await database.batch([
      database.prepare("DELETE FROM pinned_series"),
      ...body.codes.map((code, position) => database.prepare("INSERT INTO pinned_series (code, position) VALUES (?, ?)").bind(code, position)),
    ]);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "database_write_failed" }, { status: 503 });
  }
}
