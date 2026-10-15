"use client";

// Background picker: a grid of small previews in the current song's colors,
// filterable by how much they move. Our own canvas scenes draw a real still
// frame; the WebGL library backgrounds get a light CSS sketch instead (a dozen
// live WebGL previews would exhaust the browser's GPU contexts).

import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { AlbumTheme } from "@/lib/albumTheme";
import { BACKGROUNDS, MOTION_LABEL, type Motion } from "@/lib/display/backgrounds";
import type { BackgroundType } from "@/lib/display/config";
import { CANVAS_SCENES, scenePalette } from "@/components/party/DisplayBackground";
import { alpha, glowHex, tone, toneHex, glow } from "@/components/party/backgrounds/color";

const TW = 168, TH = 96;

export default function BackgroundGallery({
  value,
  onChange,
  theme,
  albumArt,
}: {
  value: BackgroundType;
  onChange: (v: BackgroundType) => void;
  theme: AlbumTheme;
  albumArt?: string;
}) {
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
              <Thumb id={b.id} theme={theme} albumArt={albumArt} />
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

const Thumb = memo(function Thumb({ id, theme, albumArt }: { id: BackgroundType; theme: AlbumTheme; albumArt?: string }) {
  const p = scenePalette(theme);
  const night = toneHex(p.c1, 6, 0.6);
  const g = [glowHex(p.c1), glowHex(p.c2), glowHex(p.c3)];
  const box = (style: CSSProperties, children?: ReactNode) => (
    <span className="block w-full rounded-lg overflow-hidden relative" style={{ aspectRatio: `${TW} / ${TH}`, ...style }}>
      {children}
    </span>
  );
  const cover = albumArt ? `url("${albumArt}") center / cover` : tone(p.c2, 40);

  switch (id) {
    case "city":
    case "synthwave":
    case "bokeh":
    case "billboard":
      return box({}, (
        <>
          <CanvasThumb id={id === "billboard" ? "city" : id} theme={theme} />
          {id === "billboard" && (
            <span className="absolute left-1/2 -translate-x-1/2 rounded-sm" style={{ top: "12%", width: "52%", aspectRatio: "16 / 7", background: tone(p.c1, 9, 0.7), border: "2px solid #0c0c0f", boxShadow: `0 0 14px ${alpha(p.accent, 0.5)}` }} />
          )}
        </>
      ));
    case "drive":
      return box({ background: `radial-gradient(ellipse at 50% 42%, ${alpha(p.accent, 0.35)}, transparent 45%), ${night}` }, (
        <svg viewBox={`0 0 ${TW} ${TH}`} className="absolute inset-0 w-full h-full" aria-hidden="true">
          {[-70, -40, 40, 70].map((dx, i) => (
            <line key={dx} x1={84} y1={40} x2={84 + dx * 1.6} y2={TH} stroke={i < 2 ? g[1] : glowHex(p.accent)} strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
          ))}
          {[-18, 18].map((dx) => <line key={dx} x1={84} y1={40} x2={84 + dx * 1.6} y2={TH} stroke="#fff" strokeWidth="1" opacity="0.5" />)}
        </svg>
      ));
    case "galaxy":
      return box({ background: `radial-gradient(circle at 50% 50%, ${alpha(g[1], 0.35)}, transparent 55%), radial-gradient(${g[0]} 1px, transparent 1.5px) 0 0 / 14px 14px, radial-gradient(${g[2]} 1px, transparent 1.5px) 7px 7px / 18px 18px, ${night}` });
    case "prism":
      return box({ background: `radial-gradient(circle at 50% 50%, transparent 8%, ${night} 70%), conic-gradient(from 0deg at 50% 50%, ${g[0]}, ${g[1]}, ${g[2]}, ${glowHex(p.accent)}, ${g[0]})` });
    case "chrome":
      return box({ background: `repeating-linear-gradient(115deg, ${toneHex(p.c2, 18)} 0 10%, ${toneHex(p.c2, 55, 0.6)} 16%, ${toneHex(p.c2, 25)} 24%, ${toneHex(p.c2, 75, 0.4)} 30%, ${toneHex(p.c2, 20)} 38%)` });
    case "aurora":
      return box({ background: `linear-gradient(180deg, ${alpha(g[0], 0.9)} 0%, ${alpha(g[1], 0.6)} 22%, ${alpha(g[2], 0.25)} 42%, transparent 60%), ${night}`, filter: "saturate(1.1)" });
    case "silk":
      return box({ background: `repeating-linear-gradient(135deg, ${toneHex(p.c2, 22)} 0 12%, ${toneHex(p.c2, 38)} 20%, ${toneHex(p.c2, 26)} 30%), ${night}` });
    case "rays":
      return box({ background: `radial-gradient(ellipse 60% 120% at 50% -10%, ${alpha(glowHex(p.accent, 62, 78), 0.85)}, transparent 70%), ${night}` });
    case "mesh":
      return box({ background: `radial-gradient(at 20% 30%, ${p.c1} 0, transparent 60%), radial-gradient(at 80% 25%, ${p.c2} 0, transparent 55%), radial-gradient(at 55% 90%, ${p.c3} 0, transparent 60%), radial-gradient(at 90% 85%, ${p.accent} 0, transparent 45%), ${theme.surface}` });
    case "fluted":
      return box({ background: cover, filter: "blur(1px)" }, (
        <span className="absolute inset-0" style={{ background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 7px, rgba(0,0,0,0.25) 7px 9px, transparent 9px 12px)" }} />
      ));
    case "halftone":
      return box({ background: night }, (
        <span className="absolute inset-0" style={{ background: cover, WebkitMaskImage: "radial-gradient(circle, #000 1.6px, transparent 2px)", maskImage: "radial-gradient(circle, #000 1.6px, transparent 2px)", WebkitMaskSize: "5px 5px", maskSize: "5px 5px" }} />
      ));
    case "vinyl":
      return box({ background: `radial-gradient(circle at 78% 50%, ${tone(p.c2, 16, 0.8)}, ${tone(p.c1, 5, 0.6)} 70%)` }, (
        <span className="absolute rounded-full" style={{ right: "-18%", top: "8%", height: "84%", aspectRatio: "1", background: "repeating-radial-gradient(circle, #101012 0 1px, #1b1b1e 1px 2px)" }}>
          <span className="absolute rounded-full" style={{ inset: "32%", background: albumArt ? cover : p.accent }} />
        </span>
      ));
    case "image":
      return box({ background: `repeating-linear-gradient(45deg, ${alpha(theme.ink, 0.08)} 0 8px, transparent 8px 16px), ${theme.surface}` }, (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--ink-50)]">Your link</span>
      ));
    case "cover":
      return box({}, <span className="absolute inset-0" style={{ background: cover, filter: "blur(6px) saturate(1.2)", transform: "scale(1.15)" }} />);
    case "soft":
      return box({ background: `radial-gradient(at 20% 30%, ${p.c1} 0, transparent 60%), radial-gradient(at 80% 20%, ${p.c2} 0, transparent 55%), radial-gradient(at 60% 90%, ${p.c3} 0, transparent 60%), ${theme.surface}` });
    case "shader":
      return box({ background: `linear-gradient(135deg, ${p.c1}, ${p.c2} 50%, ${p.c3})` });
    case "solid":
    default:
      return box({ background: theme.surface, boxShadow: `inset 0 0 0 1px ${alpha(glow(p.c1, 1), 0.1)}` });
  }
});

function CanvasThumb({ id, theme }: { id: "city" | "synthwave" | "bokeh"; theme: AlbumTheme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const scene = CANVAS_SCENES[id];
    // Drawn large and scaled down, so the skyline reads as a skyline.
    const W = TW * 4, H = TH * 4;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const octx = off.getContext("2d");
    if (!octx) return;
    scene.draw(octx, W, H, 8, scenePalette(theme), scene.create(W, H), 0);
    ctx.drawImage(off, 0, 0, TW * 2, TH * 2);
  }, [id, theme]);
  return <canvas ref={ref} width={TW * 2} height={TH * 2} className="absolute inset-0 w-full h-full" />;
}
