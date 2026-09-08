/** Displacement strength in CSS pixels, bounded to avoid folding the image. */
export function lensStrength(bevel: number) {
  // Maximum slope: .58 / 2 * PI * 1.035 (largest RGB factor) < 1.
  return bevel * .58;
}

/** Rounded-rectangle sampling vectors, directed into the surface. */
export function lensVector(x: number, y: number, width: number, height: number, radius: number, bevel: number) {
  const r = Math.max(1, Math.min(radius, width / 2, height / 2));
  const px = x - width / 2;
  const py = y - height / 2;
  const qx = Math.abs(px) - (width / 2 - r);
  const qy = Math.abs(py) - (height / 2 - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const length = Math.hypot(ox, oy);
  const depth = r - length - Math.min(Math.max(qx, qy), 0);
  if (depth <= 0 || depth >= bevel || bevel <= 0) return [0, 0] as const;

  // Zero value AND zero slope at both ends: no hard crease around the center.
  const bend = Math.sin(Math.PI * depth / bevel) ** 2;
  const nx = length > 0 ? ox / length : Number(qx > qy);
  const ny = length > 0 ? oy / length : Number(qy >= qx);
  // feDisplacementMap samples x/y + displacement, so outward normals would
  // sample transparent pixels beyond the filter bounds and create dark seams.
  return [-Math.sign(px) * nx * bend, -Math.sign(py) * ny * bend] as const;
}

export function createLensPixels(width: number, height: number, radius: number, bevel: number) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [nx, ny] = lensVector(x + .5, y + .5, width, height, radius, bevel);
      const offset = (y * width + x) * 4;
      pixels[offset] = 128 + nx * 127;
      pixels[offset + 1] = 128 + ny * 127;
      pixels[offset + 2] = 128;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}
