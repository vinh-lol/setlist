"use client";

// Runs a canvas scene: sizes the canvas to its box, ticks at a capped frame
// rate (30fps, 15 in low power), and eases between palettes over ~1.2s when the
// song changes. Reduced-motion users (or speed 0) get a single still frame.
// Scenes are plain objects: create() builds layout from a seed and the size,
// draw() paints one frame for time t (seconds, already scaled by speed).

import { memo, useEffect, useRef } from "react";
import { mixPalette, type ScenePalette } from "./color";

export interface Scene<S = unknown> {
  create: (w: number, h: number) => S;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p: ScenePalette, s: S, dt: number) => void;
}

const FADE_S = 1.2;

function CanvasScene<S>({
  scene,
  palette,
  speed = 1,
  fps = 30,
  still = false,
  stillAt = 8,
  className = "absolute inset-0 z-0 h-full w-full",
}: {
  scene: Scene<S>;
  palette: ScenePalette;
  speed?: number;
  fps?: number;
  still?: boolean;
  stillAt?: number; // the moment drawn when still
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(palette);
  const from = useRef(palette);
  const fadeStart = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const paused = speed === 0;

  // New palette: fade to it from wherever we are now.
  useEffect(() => {
    const now = performance.now() / 1000;
    const k = Math.min(1, (now - fadeStart.current) / FADE_S);
    from.current = mixPalette(from.current, target.current, k);
    target.current = palette;
    fadeStart.current = now;
  }, [palette]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const isStill = still || reduced || paused;
    let w = 0, h = 0, state: S | null = null;
    let raf = 0, last = 0, t = stillAt, prevT = stillAt;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
      if (nw === w && nh === h && state) return;
      w = nw; h = nh;
      canvas.width = w; canvas.height = h; // 1x pixels: soft scenes, far cheaper on TVs
      state = scene.create(w, h);
      paint(0);
    };
    const currentPalette = () => {
      const k = Math.min(1, (performance.now() / 1000 - fadeStart.current) / FADE_S);
      return k >= 1 ? target.current : mixPalette(from.current, target.current, k);
    };
    const paint = (dt: number) => {
      if (!state) return;
      scene.draw(ctx, w, h, t, currentPalette(), state, dt);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / fps - 1) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) * speedRef.current : 0;
      last = now;
      t += dt;
      paint(t - prevT);
      prevT = t;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    if (isStill) {
      // Still scenes repaint only while a palette fade is running.
      const fade = () => { paint(0); if (performance.now() / 1000 - fadeStart.current < FADE_S) raf = requestAnimationFrame(fade); };
      const id = setInterval(() => { if (performance.now() / 1000 - fadeStart.current < FADE_S) { cancelAnimationFrame(raf); raf = requestAnimationFrame(fade); } }, 250);
      return () => { ro.disconnect(); cancelAnimationFrame(raf); clearInterval(id); };
    }
    raf = requestAnimationFrame(loop);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, fps, still, stillAt, paused]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}

export default memo(CanvasScene) as typeof CanvasScene;
