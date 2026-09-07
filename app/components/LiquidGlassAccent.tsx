import Link from "next/link";

// The reflection is a CSS layer. No pointer listeners, animation loop, or SVG
// displacement filter is needed for this small interactive glass surface.
export function LiquidGlassAccent({ href }: { href: string }) {
  return (
    <Link className="liquid-glass-accent" href={href}>
      <span className="liquid-glass-accent__reflection" aria-hidden="true" />
      <span className="liquid-glass-accent__copy">
        <small>CARD DATABASE</small>
        <strong>進入官方卡表</strong>
      </span>
      <span className="liquid-glass-accent__arrow" aria-hidden="true">↗</span>
    </Link>
  );
}
