"use client";

import { cloneElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { updateGlassFilter } from "./glass-filter";

type SurfaceElement = ReactElement<{ children?: ReactNode; "data-liquid-glass"?: boolean }>;

/** An explicit material slot. Keeps the original semantic element and handlers. */
export function GlassSurface({ children, active = true }: { children: SurfaceElement; active?: boolean }) {
  if (!active) return children;
  return cloneElement(children, { "data-liquid-glass": true }, <GlassMaterial />, children.props.children);
}

function GlassMaterial() {
  const material = useRef<HTMLSpanElement>(null);
  const filter = useRef<SVGFilterElement>(null);
  const id = `glass-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const owner = material.current?.parentElement;
    const definition = filter.current;
    if (!owner || !definition) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const solid = matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)");
    const supported = /Chrome|Chromium|Edg\//.test(navigator.userAgent)
      && !/OPR\//.test(navigator.userAgent) && CSS.supports("backdrop-filter", 'url("#glass")');
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    const clearFilter = () => {
      owner.style.removeProperty("--glass-refraction");
      delete owner.dataset.glassRefraction;
    };
    const resize = () => {
      if (supported && !solid.matches) updateGlassFilter(owner, definition);
      else clearFilter();
    };
    const release = () => { delete owner.dataset.glassPressed; };
    const leave = () => {
      pointer = null;
      cancelAnimationFrame(frame);
      frame = 0;
      release();
      ["--glass-x", "--glass-y", "--glass-angle", "--glass-lean-x", "--glass-lean-y"].forEach(key => owner.style.removeProperty(key));
    };
    const move = (event: PointerEvent) => {
      if (reduced.matches || solid.matches) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!pointer) return;
        const rect = owner.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = Math.max(0, Math.min(1, (pointer.x - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (pointer.y - rect.top) / rect.height));
        owner.style.setProperty("--glass-x", `${x * 100}%`);
        owner.style.setProperty("--glass-y", `${y * 100}%`);
        owner.style.setProperty("--glass-angle", `${135 + (x - .5) * 110}deg`);
        owner.style.setProperty("--glass-lean-x", `${(x - .5) * 5}px`);
        owner.style.setProperty("--glass-lean-y", `${(y - .5) * 4}px`);
      });
    };
    const press = () => { if (!reduced.matches && !solid.matches) owner.dataset.glassPressed = "true"; };
    const preferencesChanged = () => { leave(); resize(); };
    const observer = new ResizeObserver(resize);
    observer.observe(owner);
    resize();
    owner.addEventListener("pointermove", move);
    owner.addEventListener("pointerleave", leave);
    owner.addEventListener("pointerdown", press);
    owner.addEventListener("pointerup", release);
    owner.addEventListener("pointercancel", leave);
    reduced.addEventListener("change", preferencesChanged);
    solid.addEventListener("change", preferencesChanged);
    return () => {
      observer.disconnect();
      leave();
      clearFilter();
      owner.removeEventListener("pointermove", move);
      owner.removeEventListener("pointerleave", leave);
      owner.removeEventListener("pointerdown", press);
      owner.removeEventListener("pointerup", release);
      owner.removeEventListener("pointercancel", leave);
      reduced.removeEventListener("change", preferencesChanged);
      solid.removeEventListener("change", preferencesChanged);
    };
  }, [id]);

  return <span ref={material} className="liquid-material" aria-hidden="true">
    <svg className="liquid-optics-definitions" focusable="false"><defs>
      <filter ref={filter} id={id} x="0" y="0" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" />
    </defs></svg>
    <span className="liquid-material__backdrop" />
    <span className="liquid-material__rim" />
  </span>;
}

/** The navigation owns its lens. Only this navigation's links are inspected. */
export function GlassNavigationLens({ activeKey }: { activeKey: string }) {
  const lens = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = lens.current;
    const navigation = element?.parentElement;
    if (!element || !navigation) return;
    let hovered: HTMLElement | null = null;
    const update = () => {
      const link = hovered ?? navigation.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!link) return;
      element.style.width = `${link.offsetWidth}px`;
      element.style.height = `${link.offsetHeight}px`;
      element.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
    };
    const follow = (event: Event) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (link && navigation.contains(link)) { hovered = link; update(); }
    };
    const restore = () => { hovered = null; update(); };
    const observer = new ResizeObserver(update);
    observer.observe(navigation);
    update();
    navigation.addEventListener("pointerover", follow);
    navigation.addEventListener("focusin", follow);
    navigation.addEventListener("pointerleave", restore);
    navigation.addEventListener("focusout", restore);
    return () => {
      observer.disconnect();
      navigation.removeEventListener("pointerover", follow);
      navigation.removeEventListener("focusin", follow);
      navigation.removeEventListener("pointerleave", restore);
      navigation.removeEventListener("focusout", restore);
    };
  }, [activeKey]);
  return <GlassSurface><span ref={lens} className="liquid-navigation-lens" aria-hidden="true" /></GlassSurface>;
}
