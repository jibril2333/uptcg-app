import assert from "node:assert/strict";
import test from "node:test";
import { createLensPixels, lensStrength, lensVector } from "../app/components/liquid-optics.ts";

test("glass lens keeps its flat center and exterior undistorted", () => {
  assert.deepEqual(lensVector(100, 40, 200, 80, 30, 18), [0, 0]);
  assert.deepEqual(lensVector(0, 0, 200, 80, 30, 18), [0, 0]);
  assert.deepEqual(lensVector(100, 0, 200, 80, 30, 18), [0, 0]);
});

test("glass lens bends opposite edges symmetrically and curves at corners", () => {
  const left = lensVector(9, 40, 200, 80, 30, 18);
  const right = lensVector(191, 40, 200, 80, 30, 18);
  assert.equal(left[0], -right[0]);
  assert.ok(left[0] > .9);
  assert.ok(Math.abs(left[1]) === 0);
  const top = lensVector(100, 9, 200, 80, 30, 18);
  assert.ok(top[1] > .9);
  assert.ok(Math.abs(top[0]) === 0);
  const corner = lensVector(15, 15, 200, 80, 30, 18);
  assert.ok(corner[0] > 0 && corner[1] > 0);
  assert.ok(Math.abs(corner[0] - corner[1]) < 1e-8);
});

test("glass refraction samples inside the surface instead of beyond the filter", () => {
  for (const [width, height, radius] of [[292, 74, 999], [226, 700, 32], [900, 80, 26]]) {
    const bevel = Math.min(30, height * .24, width * .18);
    const pixels = createLensPixels(width, height, radius, bevel);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        for (const factor of [1.035, 1, .965]) {
          const scale = lensStrength(bevel) * factor;
          const sx = x + .5 + scale * (pixels[offset] - 128) / 254;
          const sy = y + .5 + scale * (pixels[offset + 1] - 128) / 254;
          assert.ok(sx >= 0 && sx < width, `horizontal sample escaped at ${x},${y}`);
          assert.ok(sy >= 0 && sy < height, `vertical sample escaped at ${x},${y}`);
        }
      }
    }
  }
});

test("glass edge mapping has no fold or discontinuous slope at the inner boundary", () => {
  const bevel = 18;
  const scale = lensStrength(bevel) * 1.035;
  const sample = depth => depth + lensVector(depth, 40, 200, 80, 30, bevel)[0] * scale / 2;
  let previous = sample(0);
  for (let depth = .05; depth < bevel + 2; depth += .05) {
    const next = sample(depth);
    assert.ok(next > previous, `folded mapping at depth ${depth}`);
    previous = next;
  }
  const epsilon = .001;
  const innerSlope = (sample(bevel) - sample(bevel - epsilon)) / epsilon;
  const outerSlope = (sample(epsilon) - sample(0)) / epsilon;
  assert.ok(Math.abs(innerSlope - 1) < .001);
  assert.ok(Math.abs(outerSlope - 1) < .001);
});

test("glass map encodes a finite opaque RG displacement texture at varied sizes", () => {
  for (const [width, height, radius] of [[64, 40, 999], [120, 300, 32], [400, 60, 26]]) {
    const pixels = createLensPixels(width, height, radius, 12);
    assert.equal(pixels.length, width * height * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) {
      assert.equal(pixels[offset + 2], 128);
      assert.equal(pixels[offset + 3], 255);
    }
    const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
    assert.equal(pixels[center], 128);
    assert.equal(pixels[center + 1], 128);
  }
});
