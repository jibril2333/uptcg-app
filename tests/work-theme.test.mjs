import assert from "node:assert/strict";
import test from "node:test";
import { workTheme } from "../app/components/work-theme.ts";

test("work themes are stable, case-insensitive and support newly synced works", () => {
  assert.deepEqual(workTheme("eva"), workTheme("EVA"));
  assert.notDeepEqual(workTheme("EVA"), workTheme("MST"));
  assert.deepEqual(workTheme("NEW-WORK"), workTheme("NEW-WORK"));
  assert.match(workTheme("NEW-WORK")["--work-accent"], /^hsl\(\d+ 65% 76%\)$/);
});

test("deck color takes precedence and leaving a work restores the default theme", () => {
  assert.equal(workTheme("EVA", "赤")["--work-accent"], "hsl(5 65% 76%)");
  assert.equal(workTheme("MST", "緑")["--work-accent"], "hsl(143 65% 76%)");
  assert.deepEqual(workTheme("", "赤"), workTheme());
  assert.deepEqual(workTheme("EVA", "unknown"), workTheme("EVA"));
});

test("unrecognized values cannot inject styles or inherit prototype properties", () => {
  for (const invalid of ["</style>", "EVA; color:red", "a".repeat(17)]) {
    assert.deepEqual(workTheme(invalid), workTheme());
  }
  for (const color of ["constructor", "toString", "__proto__"]) {
    assert.deepEqual(workTheme("EVA", color), workTheme("EVA"));
  }
});

test("accent button text exceeds 4.5:1 contrast across every possible work hue", () => {
  const luminance = (rgb) => rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  const ink = luminance([16 / 255, 32 / 255, 48 / 255]);
  for (let hue = 0; hue < 360; hue++) {
    const l = .76, s = .65, a = s * Math.min(l, 1 - l);
    const rgb = [0, 8, 4].map(n => {
      const k = (n + hue / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    });
    assert.ok((luminance(rgb) + .05) / (ink + .05) >= 4.5, `hue ${hue}`);
  }
});
