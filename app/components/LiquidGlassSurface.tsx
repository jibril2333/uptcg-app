"use client";

import LiquidGlass from "liquid-glass-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type LiquidGlassSurfaceProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  cornerRadius?: number;
  displacementScale?: number;
  blurAmount?: number;
  saturation?: number;
  aberrationIntensity?: number;
  elasticity?: number;
  mode?: "standard" | "polar" | "prominent" | "shader";
};

export function LiquidGlassSurface({
  children,
  className = "",
  contentClassName = "",
  cornerRadius = 20,
  displacementScale = 34,
  blurAmount = 0.12,
  saturation = 132,
  aberrationIntensity = 1.25,
  elasticity = 0.08,
  mode = "prominent",
}: LiquidGlassSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  return (
    <div ref={surfaceRef} className={`liquid-glass-surface ${className}`.trim()}>
      <div className="liquid-glass-surface__effect" aria-hidden="true">
        <LiquidGlass
          className="liquid-glass-surface__engine"
          cornerRadius={cornerRadius}
          displacementScale={displacementScale}
          blurAmount={blurAmount}
          saturation={saturation}
          aberrationIntensity={aberrationIntensity}
          elasticity={reduceMotion ? 0 : elasticity}
          mode={mode}
          mouseContainer={surfaceRef}
          padding="0"
          style={{
            position: "absolute",
            inset: 0,
            top: "50%",
            left: "50%",
            width: "100%",
            height: "100%",
          }}
        >
          <span />
        </LiquidGlass>
      </div>
      <div className={`liquid-glass-surface__content ${contentClassName}`.trim()}>{children}</div>
    </div>
  );
}
