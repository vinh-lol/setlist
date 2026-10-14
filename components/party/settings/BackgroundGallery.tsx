"use client";

// Background picker: a grid of small live previews in the current song's
// colors, filterable by how much they move.

import { memo, useEffect, useRef, useState } from "react";
import type { AlbumTheme } from "@/lib/albumTheme";
import { BACKGROUNDS, MOTION_LABEL, type Motion } from "@/lib/display/backgrounds";
import type { BackgroundType } from "@/lib/display/config";
import { CANVAS_SCENES, scenePalette } from "@/components/party/DisplayBackground";
import { tone, alpha, glow } from "@/components/party/backgrounds/color";

const TW = 168, TH = 96;

export default function BackgroundGallery({ value, onChange, theme }: { value: BackgroundType; onChange: (v: BackgroundType) => void; theme: AlbumTheme }) {
  const [filter, setFilter] = useState<Motion | "all">("all");
  const list = BACKGROUNDS.filter((b) => filter === "all" || b.motion === filter);
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Filter by motion" className="flex gap-1.5">
        {(["all", "still", "calm", "lively"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={filter === m}
            onClick={() => setFilter(m)}
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-[0.08em]"
            style={{ background: filter === m ? "var(--ink)" : "var(--ink-05)", color: filter === m ? "var(--surface)" : "var(--ink-65)" }}
          >
            {m === "all" ? "All" : MOTION_LABEL[m]}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Background" className="grid grid-cols-2 gap-2">
        {list.map((b) => {
          const on = b.id === value;
          return (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(b.id)}
              className="text-left rounded-xl p-1.5 border transition-colors hover:bg-[color:var(--ink-05)]"
              style={{ borderColor: on ? "var(--ink)" : "var(--ink-10)", boxShadow: on ? "inset 0 0 0 1px var(--ink)" : undefined }}
            >
              <Thumb id={b.id} theme={theme} />
              <span className="flex items-center justify-between px-1 pt-1.5 pb-0.5">
                <span className="text-sm font-bold">{b.name}</span>
                <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-50)]">{MOTION_LABEL[b.motion]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// One still frame of the real scene where there is one; a CSS sketch otherwise.
const Thumb = memo(function Thumb({ id, theme }: { id: BackgroundType; theme: AlbumTheme }) {
  const p = scenePalette(theme);
  const box = "block w-full rounded-lg overflow-hidden relative";
  const style = { aspectRatio: `${TW} / ${TH}` };
  if (id === "city" || id === "synthwave" || id === "stars" || id === "bokeh" || id === "billboard") {
    return (
      <span className={box} style={style}>
        <CanvasThumb id={id === "billboard" ? "city" : id} theme={theme} />
        {id === "billboard" && (
          <span className="absolute left-1/2 -translate-x-1/2 rounded-sm" style={{ top: "12%", width: "52%", aspectRatio: "16 / 7", background: tone(p.c1, 9, 0.7), border: "2px solid #0c0c0f", boxShadow: `0 0 14px ${alpha(p.accent, 0.5)}` }} />
        )}
      </span>
    );
  }
  const bg: Record<string, string> = {
    solid: theme.surface,
    soft: `radial-gradient(at 20% 30%, ${p.c1} 0, transparent 60%), radial-gradient(at 80% 20%, ${p.c2} 0, transparent 55%), radial-gradient(at 60% 90%, ${p.c3} 0, transparent 60%), ${theme.surface}`,
    shader: `linear-gradient(135deg, ${p.c1}, ${p.c2} 50%, ${p.c3})`,
    cover: `radial-gradient(circle at 40% 40%, ${glow(p.c2, 1)}, ${tone(p.c1, 30)} 70%)`,
    image: `repeating-linear-gradient(45deg, ${alpha(theme.ink, 0.08)} 0 8px, transparent 8px 16px), ${theme.surface}`,
    vinyl: `radial-gradient(circle at 78% 50%, ${tone(p.c2, 16, 0.8)}, ${tone(p.c1, 5, 0.6)} 70%)`,
  };
  return (
    <span className={box} style={{ ...style, background: bg[id] ?? theme.surface, filter: id === "cover" ? "blur(0.5px)" : undefined }}>
      {id === "vinyl" && (
        <span className="absolute rounded-full" style={{ right: "-18%", top: "8%", height: "84%", aspectRatio: "1", background: "repeating-radial-gradient(circle, #101012 0 1px, #1b1b1e 1px 2px)" }}>
          <span className="absolute rounded-full" style={{ inset: "32%", background: p.accent }} />
        </span>
      )}
      {id === "image" && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--ink-50)]">Your link</span>}
    </span>
  );
});

function CanvasThumb({ id, theme }: { id: "city" | "synthwave" | "stars" | "bokeh"; theme: AlbumTheme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const scene = CANVAS_SCENES[id];
    // Draw at 2x the card size, scaled down, so the skyline reads as a skyline.
    const W = TW * 4, H = TH * 4;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const octx = off.getContext("2d");
    if (!octx) return;
    const state = scene.create(W, H);
    if (id === "stars") for (let i = 0; i < 160; i++) scene.draw(octx, W, H, 8 + i * 0.05, scenePalette(theme), state, 0.05);
    else scene.draw(octx, W, H, 8, scenePalette(theme), state, 0);
    ctx.drawImage(off, 0, 0, TW * 2, TH * 2);
  }, [id, theme]);
  return <canvas ref={ref} width={TW * 2} height={TH * 2} className="absolute inset-0 w-full h-full" />;
}
