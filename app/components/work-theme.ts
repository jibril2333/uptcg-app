const CARD_HUES: Record<string, number> = { 赤: 5, 青: 210, 黄: 44, 緑: 143, 紫: 272 };
const WORK_HUES: Record<string, number> = { EVA: 272, MST: 36 };

/** App presentation colors, not official franchise brand colors. */
export function workTheme(workCode = "", cardColor = "") {
  const code = /^[a-z0-9-]{1,16}$/i.test(workCode) ? workCode.toUpperCase() : "";
  const hash = [...code].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) % 360, 0);
  const cardHue = Object.hasOwn(CARD_HUES, cardColor) ? CARD_HUES[cardColor] : undefined;
  const workHue = Object.hasOwn(WORK_HUES, code) ? WORK_HUES[code] : undefined;
  const hue = code ? cardHue ?? workHue ?? hash : 210;
  return {
    "--work-accent": `hsl(${hue} 55% 27%)`,
    "--work-fill": `hsl(${hue} 65% 82%)`,
    "--work-accent-ink": "#102030",
    "--work-light": `hsl(${hue} 62% 88%)`,
    "--work-ambient": `hsl(${hue} 70% 82% / .5)`,
    "--work-ambient-secondary": `hsl(${(hue + 42) % 360} 65% 87% / .4)`,
    "--work-glass-tint": `hsl(${hue} 60% 97% / .48)`,
  };
}
