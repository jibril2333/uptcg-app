import { GlassSurface } from "./GlassSurface";
import Link from "next/link";

// Content stays sharp above the independently refracted backdrop layer.
export function LiquidGlassAccent({ href }: { href: string }) {
  return (
    <GlassSurface><Link className="liquid-glass-accent" href={href}>
      <span className="liquid-glass-accent__reflection" aria-hidden="true" />
      <span className="liquid-glass-accent__copy">
        <small>CARD DATABASE</small>
        <strong>進入官方卡表</strong>
      </span>
      <span className="liquid-glass-accent__arrow" aria-hidden="true">↗</span>
    </Link></GlassSurface>
  );
}
