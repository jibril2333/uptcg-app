import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared CSS declares light controls and readable foreground tokens", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--bg: #eff5fc/);
  assert.match(css, /--text: #20334b/);
  assert.match(css, /--muted: #53657a/);
  assert.match(css, /color-scheme: light/);
  assert.doesNotMatch(css, /color-scheme: dark/);
  for (const color of ["#f3a420", "#ffb52c", "#e3a32e", "#ff7818"]) {
    assert.ok(!css.includes(color), `legacy decoration ${color}`);
  }
});

test("light glass preserves optical and accessibility fallbacks", async () => {
  const css = await readFile(new URL("../app/liquid-glass.css", import.meta.url), "utf8");
  assert.match(css, /backdrop-filter: var\(--glass-refraction\)/);
  assert.match(css, /prefers-reduced-transparency: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /background: Canvas !important/);
  assert.match(css, /button:disabled/);
  assert.doesNotMatch(css, /--glass-tint: #(131926|17202c|121b2a|182133|18202f)/);
});
