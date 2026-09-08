# Liquid Glass web material

This iteration prioritizes the visual properties of Liquid Glass over the earlier
low-cost frosted-glass approximation. It is a web interpretation, not Apple's
native compositor.

## Layers

- `GlassSurface.tsx` explicitly equips navigation, homepage shortcuts, filtering
  controls and card-detail dialogs with their own material. It preserves the
  original semantic element, handlers and content. Card images and text are not filtered.
- A rounded-rectangle signed-distance field supplies an edge normal map. Convex
  edges displace the actual backdrop; the center of the map stays neutral.
  Sampling is inward, with a smooth squared-sine envelope and strength bounded
  to prevent image folding. Encoded R/G value 128 is normalized to exactly 0.5.
  The map uses the material layer's padding-box dimensions, not its border box.
- Three SVG displacement paths split red, green and blue very slightly at the edge.
- Separate backdrop and rim elements add clear tint, opposite specular arcs,
  inner highlights and depth shadows behind the content. Pointer position steers
  the light, and press/hover states flex. Decorative layers are hidden from
  assistive technology and do not receive pointer input.
- A shared glass capsule slides between navigation options on pointer/focus input,
  returning to the current page on exit. Navigation destinations remain unchanged.
- Each mounted surface owns its ResizeObserver, SVG filter and input listeners.
  React mounts/unmounts selected product materials and dialogs directly; there is
  no document-wide surface scan, MutationObserver or global filter registry.
  Unmounted surfaces release their observers, event listeners and animation frames.

## Work-aware surroundings

`WorkThemeProvider` applies CSS variables to the shared layout without modifying
body styles or persistent data. Catalog/collection routes select a work theme;
the deck editor gives the chosen card color precedence. Leaving the route clears
its selection. EVA and MST have curated presentation hues; other works use a
stable code-derived hue, including newly synchronized works. These are app
presentation colors, not official franchise brand colors. Invalid codes fall
back to the default theme. Light accents use dark button text for legibility.

## Light palette

The global palette is now light (`color-scheme: light`): ice-blue surroundings,
white translucent material and slate text. Legacy hardcoded black/gold UI colors
in catalog, collection, decks, rules and settings are normalized to shared text
and accent tokens. Work themes split dark foreground accents from pale button
fills, and their contrast is tested across all possible hues. Deck-image export
uses the same light palette. The sidebar brand tile reuses the existing card icon.

Card art and semantic deck-color swatches are unchanged. Image captions retain
dark scrims for readability; unowned cards remain grayscale, but are no longer
darkened. Error/ban, restriction and enabled states retain distinct semantic colors.
No layout, synchronization, data schema or saved-data changes are included.

## Browser behavior and accessibility

SVG backdrop filters are enabled conservatively on Chromium. Parsing success from
`CSS.supports` is not evidence that a browser renders a reference filter correctly.
Safari and Firefox therefore use the translucent CSS blur, tint and specular layers,
with the same input response, but without actual backdrop displacement/color splitting.
This means the iPhone browser version is not pixel-identical to native iOS materials.

Reduced motion disables pointer-driven movement and elastic transitions. Reduced
transparency, increased contrast and forced colors use solid accessible surfaces.
There is no device-based performance downgrade of refraction in supported browsers.
The lens texture is bounded to 900 pixels on its longest axis, then scaled to the
surface size; its shape is generated from that surface's actual aspect ratio/radius.

## Verification

`npm run lint` and `npm test` cover static correctness, production build, existing
application regression tests and the lens map's geometry/encoding. These do not
certify native visual parity, browser compositor behavior or frame rate. A visual
review on the user's target browser remains important before approving production.

Preview/test data must be disposable. This change does not modify the Mac Actions
deployment, Docker configuration, database schemas, card synchronization or user data.

### This iteration's checks

- `npm run lint`: passed, exit 0.
- `npm test`: production build succeeded; all 24 tests passed, exit 0.
- Theme tests cover deterministic new-work colors, deck-color precedence,
  default reset, invalid/prototype inputs and light-theme text/button contrast across all 360 hues.
  CSS checks cover light native controls, removed legacy colors and accessible fallbacks.
  Rendered HTML checks include the explicit, decorative-only material layers.
- Inner-frame regression: the previous 292×74 capsule map sampled outside the
  filter at 8,128 pixel centers (strongest RGB channel); the corrected map has 0.
  Tests also check smooth slopes and monotonic sampling through the lens edge.
- Temporary fixture-backed homepage: HTTP 200.
- `tsc --noEmit --incremental false`: exit 2, with the same 10 diagnostics on
  baseline commit `33cc65a` and this change. The existing diagnostics are missing
  `D1Database`/`Fetcher`/`cloudflare:workers` types and consequent implicit-any
  parameters in the API/storage layer. No new diagnostics were introduced.
- No browser visual/performance QA, production deployment, production card sync
  or production-data operation was performed.

## References

- [Apple: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
- [MDN: feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap)
- [WebKit: SVG backdrop-filter compatibility](https://bugs.webkit.org/show_bug.cgi?id=245510)
