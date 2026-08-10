"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

type LiquidGlassAccentProps = {
  href: string;
};

export function LiquidGlassAccent({ href }: LiquidGlassAccentProps) {
  const accentRef = useRef<HTMLAnchorElement>(null);
  const filterId = useId().replaceAll(":", "");

  useEffect(() => {
    const accent = accentRef.current;
    if (!accent) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let rect: DOMRect | null = null;
    let latestPointer: PointerEvent | null = null;
    let listening = false;

    const reset = () => {
      rect = null;
      latestPointer = null;
      accent.dataset.active = "false";
      accent.style.setProperty("--glass-x", "50%");
      accent.style.setProperty("--glass-y", "50%");
      accent.style.setProperty("--glass-rotate-x", "0deg");
      accent.style.setProperty("--glass-rotate-y", "0deg");
    };

    const renderPointer = () => {
      frame = 0;
      if (!rect || !latestPointer) return;

      const x = Math.min(1, Math.max(0, (latestPointer.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (latestPointer.clientY - rect.top) / rect.height));
      accent.style.setProperty("--glass-x", `${(x * 100).toFixed(2)}%`);
      accent.style.setProperty("--glass-y", `${(y * 100).toFixed(2)}%`);
      accent.style.setProperty("--glass-rotate-x", `${((0.5 - y) * 3).toFixed(2)}deg`);
      accent.style.setProperty("--glass-rotate-y", `${((x - 0.5) * 4).toFixed(2)}deg`);
    };

    const handlePointerEnter = (event: PointerEvent) => {
      rect = accent.getBoundingClientRect();
      latestPointer = event;
      accent.dataset.active = "true";
      if (!frame) frame = window.requestAnimationFrame(renderPointer);
    };

    const handlePointerMove = (event: PointerEvent) => {
      latestPointer = event;
      if (!frame) frame = window.requestAnimationFrame(renderPointer);
    };

    const addPointerListeners = () => {
      if (listening) return;
      listening = true;
      accent.addEventListener("pointerenter", handlePointerEnter);
      accent.addEventListener("pointermove", handlePointerMove, { passive: true });
      accent.addEventListener("pointerleave", reset);
    };

    const removePointerListeners = () => {
      if (!listening) return;
      listening = false;
      accent.removeEventListener("pointerenter", handlePointerEnter);
      accent.removeEventListener("pointermove", handlePointerMove);
      accent.removeEventListener("pointerleave", reset);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      reset();
    };

    const configureInteraction = () => {
      const interactive = finePointer.matches && !reducedMotion.matches;
      accent.dataset.interactive = String(interactive);
      if (interactive) addPointerListeners();
      else removePointerListeners();
    };

    configureInteraction();
    finePointer.addEventListener("change", configureInteraction);
    reducedMotion.addEventListener("change", configureInteraction);

    return () => {
      finePointer.removeEventListener("change", configureInteraction);
      reducedMotion.removeEventListener("change", configureInteraction);
      removePointerListeners();
    };
  }, []);

  return (
    <Link ref={accentRef} className="liquid-glass-accent" href={href} data-active="false" data-interactive="false">
      <svg className="liquid-glass-accent__filters" aria-hidden="true">
        <filter id={filterId} x="-8%" y="-18%" width="116%" height="136%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="1" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <span className="liquid-glass-accent__surface" style={{ filter: `url(#${filterId})` }} aria-hidden="true" />
      <span className="liquid-glass-accent__shine" aria-hidden="true" />
      <span className="liquid-glass-accent__copy">
        <small>CARD DATABASE</small>
        <strong>進入官方卡表</strong>
      </span>
      <span className="liquid-glass-accent__arrow" aria-hidden="true">↗</span>
    </Link>
  );
}
