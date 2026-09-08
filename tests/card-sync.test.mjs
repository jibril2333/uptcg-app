import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("card sync keeps official images remote", async () => {
  const source = await readFile(new URL("../scripts/sync-ua-cards.mjs", import.meta.url), "utf8");

  assert.match(source, /imageOfficialUrl/);
  assert.match(source, /image: `\/cards\/\$\{productKey\}\/\$\{card\.imageFileName\}`/);
  assert.doesNotMatch(source, /fetchWithRetry\(card\.imageOfficialUrl/);
  assert.doesNotMatch(source, /writeFile\([^\n]*card\.imageFileName/);
  assert.doesNotMatch(source, /Images\s+\$\{/);
});
