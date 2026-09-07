import assert from "node:assert/strict";
import test from "node:test";
import { createLensPixels, lensVector } from "../app/components/liquid-optics.ts";

test("glass lens keeps its flat center and exterior undistorted", () => {
  assert.deepEqual(lensVector(100, 40, 200, 80, 30, 18), [0, 0]);
  assert.deepEqual(lensVector(0, 0, 200, 80, 30, 18), [0, 0]);
  assert.deepEqual(lensVector(100, 0, 200, 80, 30, 18), [0, 0]);
});

test("glass lens bends opposite edges symmetrically and curves at corners", () => {
  const left = lensVector(9, 40, 200, 80, 30, 18);
  const right = lensVector(191, 40, 200, 80, 30, 18);
  assert.equal(left[0], -right[0]);
  assert.ok(left[0] < -.9);
  assert.equal(left[1], 0);
  const top = lensVector(100, 9, 200, 80, 30, 18);
  assert.ok(top[1] < -.9);
  assert.equal(top[0], 0);
  const corner = lensVector(15, 15, 200, 80, 30, 18);
  assert.ok(corner[0] < 0 && corner[1] < 0);
  assert.ok(Math.abs(corner[0] - corner[1]) < 1e-8);
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
