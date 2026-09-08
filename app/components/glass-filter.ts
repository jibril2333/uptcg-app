import { createLensPixels, lensStrength } from "./liquid-optics";

const svgNS = "http://www.w3.org/2000/svg";

function svgNode(name: string, attributes: Record<string, string | number>) {
  const node = document.createElementNS(svgNS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}


/** Paint only the filter owned by this surface; no document-wide registry. */
export function updateGlassFilter(element: HTMLElement, filter: SVGFilterElement) {
  // The inset:0 material layer occupies the padding box, not the border box.
  const width = element.clientWidth;
  const height = element.clientHeight;
  if (!width || !height) return;
  const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 24;
  const ratio = Math.min(1, 900 / Math.max(width, height));
  const w = Math.max(2, Math.round(width * ratio));
  const h = Math.max(2, Math.round(height * ratio));
  const bevel = Math.min(30, height * .24, width * .18);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = context.createImageData(w, h);
  image.data.set(createLensPixels(w, h, radius * ratio, bevel * ratio));
  context.putImageData(image, 0, 0);

  const strength = lensStrength(bevel);
  filter.replaceChildren();
  filter.setAttribute("width", String(width));
  filter.setAttribute("height", String(height));
  filter.append(svgNode("feImage", { href: canvas.toDataURL(), x: 0, y: 0, width, height, preserveAspectRatio: "none", result: "encodedLens" }));
  // An 8-bit value of 128 is not exactly .5. Normalize R/G so the flat
  // center has truly zero displacement in every color channel.
  const normalize = svgNode("feComponentTransfer", { in: "encodedLens", result: "lens" });
  for (const channel of ["R", "G"]) {
    normalize.append(svgNode(`feFunc${channel}`, { type: "linear", slope: 255 / 254, intercept: -1 / 254 }));
  }
  filter.append(normalize);
  filter.append(svgNode("feGaussianBlur", { in: "SourceGraphic", stdDeviation: .65, edgeMode: "duplicate", result: "scene" }));
  // Separate RGB paths make the strongest curved edges split light subtly.
  [1.035, 1, .965].forEach((factor, channel) => {
    filter.append(svgNode("feDisplacementMap", { in: "scene", in2: "lens", scale: strength * factor, xChannelSelector: "R", yChannelSelector: "G", result: `bend${channel}` }));
    const matrix = Array.from({ length: 20 }, (_, index) => (index === channel * 6 || index === 18) ? 1 : 0);
    filter.append(svgNode("feColorMatrix", { in: `bend${channel}`, type: "matrix", values: matrix.join(" "), result: `channel${channel}` }));
  });
  filter.append(svgNode("feBlend", { in: "channel0", in2: "channel1", mode: "screen", result: "redGreen" }));
  filter.append(svgNode("feBlend", { in: "redGreen", in2: "channel2", mode: "screen" }));
  element.style.setProperty("--glass-refraction", `url("#${filter.id}")`);
  element.dataset.glassRefraction = "true";
}
