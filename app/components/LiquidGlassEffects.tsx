"use client";

import { useEffect, useId, useRef } from "react";
import { createLensPixels } from "./liquid-optics";

const surfaces = [
  ".spatial-sidebar", ".bottom-nav", ".liquid-navigation-lens",
  ".liquid-glass-accent", ".spatial-window",
  ".card-toolbar", ".collection-filters", ".deck-builder-controls",
  ".card-modal__panel", ".card-modal__close", ".deck-setup-footer",
  ".card-product-tabs button.is-active", ".deck-builder-product-tabs button.is-active",
].join(",");
const svgNS = "http://www.w3.org/2000/svg";

function svgNode(name: string, attributes: Record<string, string | number>) {
  const node = document.createElementNS(svgNS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

/** Progressive optical layer. It never replaces controls or filters their text. */
export function LiquidGlassEffects() {
  const defs = useRef<SVGDefsElement>(null);
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    const definitions = defs.current;
    if (!definitions) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const solid = window.matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)");
    // CSS.supports only verifies parsing, not SVG-backdrop rendering. Keep the
    // reference filter opt-in to Chromium; WebKit/Gecko retain the CSS material.
    const refractionSupported = /Chrome|Chromium|Edg\//.test(navigator.userAgent)
      && !/OPR\//.test(navigator.userAgent)
      && CSS.supports("backdrop-filter", 'url("#glass")');
    const entries = new Map<HTMLElement, { filter: SVGElement; cleanup: () => void; size: string }>();
    const navigations = new Map<HTMLElement, { update: () => void; cleanup: () => void }>();
    let nextId = 0;
    let scanFrame = 0;

    const resize = (element: HTMLElement) => {
      const entry = entries.get(element);
      if (!entry) return;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      if (!width || !height) return;
      const radius = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) || 24;
      const signature = `${width}:${height}:${radius}`;
      if (entry.size === signature) return;
      entry.size = signature;
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

      const strength = Math.min(64, Math.max(18, bevel * 2.2));
      entry.filter.replaceChildren();
      entry.filter.setAttribute("width", String(width));
      entry.filter.setAttribute("height", String(height));
      entry.filter.append(svgNode("feImage", { href: canvas.toDataURL(), x: 0, y: 0, width, height, preserveAspectRatio: "none", result: "lens" }));
      entry.filter.append(svgNode("feGaussianBlur", { in: "SourceGraphic", stdDeviation: .65, result: "scene" }));
      // Separate RGB paths make the strongest curved edges split light subtly.
      [1.035, 1, .965].forEach((factor, channel) => {
        entry.filter.append(svgNode("feDisplacementMap", { in: "scene", in2: "lens", scale: strength * factor, xChannelSelector: "R", yChannelSelector: "G", result: `bend${channel}` }));
        const matrix = Array.from({ length: 20 }, (_, index) => (index === channel * 6 || index === 18) ? 1 : 0);
        entry.filter.append(svgNode("feColorMatrix", { in: `bend${channel}`, type: "matrix", values: matrix.join(" "), result: `channel${channel}` }));
      });
      entry.filter.append(svgNode("feBlend", { in: "channel0", in2: "channel1", mode: "screen", result: "redGreen" }));
      entry.filter.append(svgNode("feBlend", { in: "redGreen", in2: "channel2", mode: "screen" }));
      element.style.setProperty("--glass-refraction", `url("#${entry.filter.id}")`);
      element.dataset.glassRefraction = "true";
    };

    const observer = new ResizeObserver(records => records.forEach(record => {
      const element = record.target as HTMLElement;
      resize(element);
      navigations.get(element)?.update();
    }));

    const attachNavigation = (navigation: HTMLElement) => {
      const lens = document.createElement("span");
      lens.className = "liquid-navigation-lens";
      lens.setAttribute("aria-hidden", "true");
      navigation.dataset.glassNavigation = "true";
      navigation.append(lens);
      let hovered: HTMLElement | null = null;
      const update = () => {
        const link = hovered ?? navigation.querySelector<HTMLElement>('a[aria-current="page"]');
        if (!link) return;
        lens.style.width = `${link.offsetWidth}px`;
        lens.style.height = `${link.offsetHeight}px`;
        lens.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
      };
      const follow = (event: Event) => {
        const link = event.target instanceof Element ? event.target.closest("a") : null;
        if (link && navigation.contains(link)) { hovered = link; update(); }
      };
      const restore = () => { hovered = null; update(); };
      navigation.addEventListener("pointerover", follow);
      navigation.addEventListener("focusin", follow);
      navigation.addEventListener("pointerleave", restore);
      navigation.addEventListener("focusout", restore);
      navigations.set(navigation, { update, cleanup: () => {
        observer.unobserve(navigation);
        navigation.removeEventListener("pointerover", follow);
        navigation.removeEventListener("focusin", follow);
        navigation.removeEventListener("pointerleave", restore);
        navigation.removeEventListener("focusout", restore);
        delete navigation.dataset.glassNavigation;
        lens.remove();
      } });
      observer.observe(navigation);
      update();
    };

    const attach = (element: HTMLElement) => {
      const filter = svgNode("filter", { id: `liquid-${prefix}-${nextId++}`, x: 0, y: 0, filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
      definitions.append(filter);
      element.dataset.liquidGlass = "true";
      let frame = 0;
      let pointer: { x: number; y: number } | null = null;
      const move = (event: PointerEvent) => {
        if (reduced.matches || solid.matches) return;
        pointer = { x: event.clientX, y: event.clientY };
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!pointer) return;
          const rect = element.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (pointer.x - rect.left) / rect.width));
          const y = Math.max(0, Math.min(1, (pointer.y - rect.top) / rect.height));
          element.style.setProperty("--glass-x", `${x * 100}%`);
          element.style.setProperty("--glass-y", `${y * 100}%`);
          element.style.setProperty("--glass-angle", `${135 + (x - .5) * 110}deg`);
          element.style.setProperty("--glass-lean-x", `${(x - .5) * 5}px`);
          element.style.setProperty("--glass-lean-y", `${(y - .5) * 4}px`);
        });
      };
      const release = () => { delete element.dataset.glassPressed; };
      const leave = () => {
        pointer = null;
        cancelAnimationFrame(frame);
        frame = 0;
        release();
        ["--glass-x", "--glass-y", "--glass-angle", "--glass-lean-x", "--glass-lean-y"].forEach(key => element.style.removeProperty(key));
      };
      const press = () => {
        if (!reduced.matches && !solid.matches) element.dataset.glassPressed = "true";
      };
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", leave);
      element.addEventListener("pointerdown", press);
      element.addEventListener("pointerup", release);
      element.addEventListener("pointercancel", leave);
      entries.set(element, {
        filter, size: "",
        cleanup: () => {
          leave();
          observer.unobserve(element);
          element.removeEventListener("pointermove", move);
          element.removeEventListener("pointerleave", leave);
          element.removeEventListener("pointerdown", press);
          element.removeEventListener("pointerup", release);
          element.removeEventListener("pointercancel", leave);
          delete element.dataset.liquidGlass;
          delete element.dataset.glassRefraction;
          element.style.removeProperty("--glass-refraction");
          filter.remove();
        },
      });
      if (refractionSupported && !solid.matches) {
        observer.observe(element);
        resize(element);
      }
    };

    const scan = () => {
      scanFrame = 0;
      navigations.forEach((navigation, element) => {
        if (!element.isConnected) { navigation.cleanup(); navigations.delete(element); }
        else navigation.update();
      });
      document.querySelectorAll<HTMLElement>(".spatial-sidebar__nav, .bottom-nav").forEach(element => {
        if (!navigations.has(element)) attachNavigation(element);
      });
      entries.forEach((entry, element) => {
        if (!element.isConnected || !element.matches(surfaces)) {
          entry.cleanup();
          entries.delete(element);
        }
      });
      document.querySelectorAll<HTMLElement>(surfaces).forEach(element => {
        if (!entries.has(element)) attach(element);
      });
    };
    const rescan = () => { if (!scanFrame) scanFrame = requestAnimationFrame(scan); };
    const reset = () => {
      entries.forEach(entry => entry.cleanup());
      entries.clear();
      navigations.forEach(navigation => navigation.cleanup());
      navigations.clear();
      rescan();
    };
    const mutations = new MutationObserver(records => {
      if (records.some(record => !definitions.contains(record.target))) rescan();
    });
    scan();
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    reduced.addEventListener("change", reset);
    solid.addEventListener("change", reset);
    return () => {
      mutations.disconnect();
      cancelAnimationFrame(scanFrame);
      entries.forEach(entry => entry.cleanup());
      navigations.forEach(navigation => navigation.cleanup());
      observer.disconnect();
      reduced.removeEventListener("change", reset);
      solid.removeEventListener("change", reset);
    };
  }, [prefix]);

  return <svg className="liquid-optics-definitions" aria-hidden="true" focusable="false"><defs ref={defs} /></svg>;
}
