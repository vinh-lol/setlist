"use client";

// Music visualizer background, built on Butterchurn (MIT), the WebGL port of
// the classic Winamp MilkDrop visualizer, with its preset pack
// (butterchurn-presets, MIT). Both load only when this background is picked.
//
// It reacts to sound from the microphone (the room's music) or, without a mic,
// to a built-in beat. The look changes per song (each song always gets the same
// one), every minute, or never; V skips to another. Motion speed scales the
// animation; the optional tint recolors it with the cover's colors.

import { memo, useEffect, useRef, useState } from "react";
import type { Visualizer as BC } from "butterchurn";
import { beatLevels, getAudioContext, getMicState, startMicIfAllowed, subscribe, visualizerSupported } from "@/lib/display/visualizerAudio";
import { tone, type ScenePalette } from "./color";

const MAX_W = 1280; // render size cap; the canvas is scaled up to fill the screen
const BLEND_S = 2.7;

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

function Visualizer({
  palette,
  speed,
  source,
  tint,
  change,
  trackId,
}: {
  palette: ScenePalette;
  speed: number;
  source: "mic" | "beat";
  tint: boolean;
  change: "song" | "minute" | "never";
  trackId: string | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const viz = useRef<BC | null>(null);
  const presets = useRef<object[]>([]);
  const pick = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const [supported, setSupported] = useState(true);

  const show = (i: number, blend = BLEND_S) => {
    const list = presets.current;
    if (!viz.current || !list.length) return;
    pick.current = ((i % list.length) + list.length) % list.length;
    viz.current.loadPreset(list[pick.current], blend);
  };

  // Set up Butterchurn once.
  useEffect(() => {
    if (!visualizerSupported()) { setSupported(false); return; }
    let raf = 0, last = 0, cancelled = false, eased = speedRef.current, beatT = 0;
    let ro: ResizeObserver | null = null;
    let connected: AudioNode | null = null;
    let unsub = () => {};
    (async () => {
      const [bcMod, presetMod] = await Promise.all([import("butterchurn"), import("butterchurn-presets")]);
      const canvas = ref.current;
      if (cancelled || !canvas) return;
      const bc = (bcMod as unknown as { default?: typeof bcMod.default }).default ?? (bcMod as unknown as typeof bcMod.default);
      const pk = (presetMod as unknown as { default?: typeof presetMod.default }).default ?? (presetMod as unknown as typeof presetMod.default);
      const all = pk.getPresets();
      presets.current = Object.keys(all).sort().map((k) => all[k]);

      const ac = getAudioContext();
      const size = () => {
        const r = canvas.getBoundingClientRect();
        const k = Math.min(1, MAX_W / Math.max(1, r.width));
        return [Math.max(2, Math.round(r.width * k)), Math.max(2, Math.round(r.height * k))] as const;
      };
      const [w, h] = size();
      canvas.width = w; canvas.height = h;
      const v = bc.createVisualizer(ac, canvas, { width: w, height: h, pixelRatio: 1, textureRatio: 1 });
      viz.current = v;
      show(trackId ? hash(trackId) : 0, 0);

      ro = new ResizeObserver(() => {
        const [nw, nh] = size();
        if (nw === canvas.width && nh === canvas.height) return;
        canvas.width = nw; canvas.height = nh;
        v.setRendererSize(nw, nh);
      });
      ro.observe(canvas);

      // Hook up the mic whenever it's listening (now or later).
      const sync = () => {
        const { node } = getMicState();
        if (node && node !== connected) { v.connectAudio(node); connected = node; }
      };
      unsub = subscribe(sync);
      sync();
      if (sourceRef.current === "mic") startMicIfAllowed();

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const real = last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        eased += (speedRef.current - eased) * Math.min(1, real / 0.4); // glide, don't jump
        beatT += real;
        const useMic = sourceRef.current === "mic" && getMicState().status === "listening";
        v.render({
          elapsedTime: real * eased,
          ...(useMic ? {} : { audioLevels: beatLevels(beatT, 118, ac.sampleRate) }),
        });
      };
      raf = requestAnimationFrame(loop);
    })().catch(() => setSupported(false));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      unsub();
      if (connected && viz.current) viz.current.disconnectAudio(connected);
      viz.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New song: its own look (same song, same look).
  useEffect(() => {
    if (change === "song" && trackId) show(hash(trackId));
  }, [trackId, change]);

  // Every minute.
  useEffect(() => {
    if (change !== "minute") return;
    const id = setInterval(() => show(pick.current + 1 + Math.floor(Math.random() * 20)), 60_000);
    return () => clearInterval(id);
  }, [change]);

  // V = another look.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key.toLowerCase() === "v" && !e.metaKey && !e.ctrlKey && !e.altKey) show(pick.current + 1 + Math.floor(Math.random() * 30));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const night = tone(palette.c1, 5, 0.6);
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" style={{ background: night }} aria-hidden="true">
      {supported && <canvas ref={ref} className="absolute inset-0 h-full w-full" />}
      {tint && (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${palette.c1}, ${palette.c2} 50%, ${palette.c3})`, mixBlendMode: "color", opacity: 0.7 }}
        />
      )}
      {/* keep text readable over the brightest presets */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.35)" }} />
    </div>
  );
}

export default memo(Visualizer);
