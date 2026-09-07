# Liquid Glass web material

This iteration prioritizes the visual properties of Liquid Glass over the earlier
low-cost frosted-glass approximation. It is a web interpretation, not Apple's
native compositor.

## Layers

- `LiquidGlassEffects.tsx` progressively enhances navigation, homepage shortcuts,
  filtering controls and card-detail dialogs. Card images and text are not filtered.
- A rounded-rectangle signed-distance field supplies an edge normal map. Convex
  edges displace the actual backdrop; the center of the map stays neutral.
- Three SVG displacement paths split red, green and blue very slightly at the edge.
- Separate CSS layers add clear tint, opposite specular arcs, inner highlights and
  depth shadows. Pointer position steers the light, and press/hover states flex.
- A shared glass capsule slides between navigation options on pointer/focus input,
  returning to the current page on exit. Navigation destinations remain unchanged.
- ResizeObserver regenerates the lens texture for each surface's geometry.
  MutationObserver handles route changes, product selections and opened dialogs.
  Detached surfaces release their filters, event listeners and pending animation frames.

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
- `npm test`: production build succeeded; all 16 tests passed, exit 0.
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
