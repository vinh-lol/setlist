"use client";

// A lit billboard on a rooftop over the night city. The board shows the current
// cover and song, or the current lyric line. Behind it the city holds its
// skyline in place (no panning) while the beams, train, traffic, water and
// window lights keep moving, at the shared Motion speed.

import { memo } from "react";
import type { SpotifyTrack } from "@/lib/types";
import CanvasScene from "./CanvasScene";
import { makeCityScene } from "./city";
import { alpha, glow, tone, type ScenePalette } from "./color";

// Moon on the left so it isn't hidden behind the board.
const billboardCity = makeCityScene({ moonX: 0.12, seed: 7, drift: false });
const STEEL = "#0b0b0e";
const LAMP = "rgba(255,246,220,";

function Billboard({
  palette,
  track,
  lyricLine,
  show,
  speed = 1,
  fps = 30,
}: {
  palette: ScenePalette;
  track: SpotifyTrack | null;
  lyricLine: string | null;
  show: "cover" | "lyrics";
  speed?: number;
  fps?: number;
}) {
  const screen = tone(palette.c1, 9, 0.7);
  const light = glow(palette.accent, 1, 62, 76);
  const line = show === "lyrics" ? lyricLine || track?.name || "" : "";
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <CanvasScene scene={billboardCity} palette={palette} speed={speed * 0.6} fps={fps} />

      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "8%", width: "min(52vw, 92vh)" }}>
        {/* the board */}
        <div
          className="relative w-full overflow-hidden flex items-center"
          style={{
            aspectRatio: "16 / 7",
            background: screen,
            border: `8px solid ${STEEL}`,
            borderRadius: 4,
            boxShadow: `0 0 120px ${alpha(palette.accent, 0.35)}, 0 0 0 1px rgba(255,255,255,0.08)`,
          }}
        >
          {show === "cover" ? (
            <>
              {track?.albumArt && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={track.albumArt} alt="" className="h-full aspect-square object-cover" />
              )}
              <div className="min-w-0 flex-1 px-[4%]">
                <p className="uppercase tracking-[0.2em] font-bold" style={{ fontSize: "clamp(10px, 1.1vw, 18px)", color: light }}>Now playing</p>
                <p className="uppercase leading-[0.95] line-clamp-2" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3.6vw, 72px)", color: "#FFFFFF", textShadow: `0 0 18px ${alpha(palette.accent, 0.6)}` }}>
                  {track?.name ?? ""}
                </p>
                <p className="uppercase tracking-wide truncate mt-1" style={{ fontSize: "clamp(12px, 1.4vw, 24px)", color: "rgba(255,255,255,0.7)" }}>
                  {track?.artists.join(", ") ?? ""}
                </p>
              </div>
            </>
          ) : (
            <p
              key={line}
              className="w-full px-[5%] text-center uppercase leading-[0.95] line-clamp-3 party-bg-fade"
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3.8vw, 76px)", color: "#FFFFFF", textShadow: `0 0 22px ${alpha(palette.accent, 0.7)}` }}
            >
              {line}
            </p>
          )}
          {/* lamps washing the board from below, scanlines, glare */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: [
              `radial-gradient(ellipse 30% 90% at 18% 105%, ${LAMP}0.2), transparent 70%)`,
              `radial-gradient(ellipse 30% 90% at 50% 105%, ${LAMP}0.2), transparent 70%)`,
              `radial-gradient(ellipse 30% 90% at 82% 105%, ${LAMP}0.2), transparent 70%)`,
              "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0 2px, transparent 2px 4px)",
              "linear-gradient(120deg, rgba(255,255,255,0.08), transparent 40%)",
            ].join(", "),
          }} />
        </div>

        {/* catwalk, lamps, truss legs and the rooftop, drawn as one silhouette */}
        <svg viewBox="0 0 1000 420" preserveAspectRatio="none" className="block w-full overflow-visible" style={{ height: "34vh" }}>
          <defs>
            <linearGradient id="bb-roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={tone(palette.c1, 8, 0.5)} />
              <stop offset="1" stopColor={tone(palette.c1, 3, 0.5)} />
            </linearGradient>
            <radialGradient id="bb-spill" cx="0.5" cy="0" r="0.7">
              <stop offset="0" stopColor={alpha(palette.accent, 0.3)} />
              <stop offset="1" stopColor={alpha(palette.accent, 0)} />
            </radialGradient>
          </defs>
          {/* catwalk with railing */}
          <rect x="20" y="0" width="960" height="10" fill={STEEL} />
          {Array.from({ length: 25 }, (_, i) => <rect key={i} x={30 + i * 39} y="10" width="2" height="22" fill={STEEL} />)}
          <rect x="20" y="30" width="960" height="3" fill={STEEL} />
          {/* lamps on arms */}
          {[180, 500, 820].map((x) => (
            <g key={x}>
              <rect x={x - 2} y="8" width="4" height="40" fill={STEEL} />
              <rect x={x - 16} y="44" width="32" height="12" rx="3" fill={STEEL} />
              <rect x={x - 11} y="44" width="22" height="3" fill={`${LAMP}0.95)`} />
            </g>
          ))}
          {/* two truss legs with cross bracing */}
          {[230, 730].map((x) => (
            <g key={x} stroke={STEEL} fill="none">
              <line x1={x} y1="10" x2={x} y2="300" strokeWidth="7" />
              <line x1={x + 40} y1="10" x2={x + 40} y2="300" strokeWidth="7" />
              {[30, 97, 164, 231].map((y) => (
                <g key={y} strokeWidth="3">
                  <line x1={x} y1={y} x2={x + 40} y2={y + 67} />
                  <line x1={x + 40} y1={y} x2={x} y2={y + 67} />
                </g>
              ))}
            </g>
          ))}
          {/* rooftop with parapet, light spill, vents and an aircraft light */}
          <rect x="0" y="300" width="1000" height="120" fill="url(#bb-roof)" />
          <rect x="0" y="300" width="1000" height="120" fill="url(#bb-spill)" />
          <rect x="0" y="296" width="1000" height="5" fill={tone(palette.c2, 18, 0.6)} />
          {/* the building's top floors */}
          {[338, 378].map((y, r) =>
            Array.from({ length: 24 }, (_, i) => (i * 7 + r * 5) % 9 < 4 && (
              <rect key={`${y}-${i}`} x={22 + i * 40.5} y={y} width="16" height="14" fill={i % 5 === 2 ? glow(palette.c2, 0.55, 60, 72) : `${LAMP}0.35)`} />
            )),
          )}
          <rect x="70" y="270" width="70" height="30" fill={STEEL} />
          <rect x="860" y="262" width="54" height="38" fill={STEEL} />
          <rect x="884" y="226" width="4" height="36" fill={STEEL} />
          <rect x="880" y="220" width="12" height="8" fill="rgba(255,60,60,0.95)" className="party-blink" />
        </svg>
      </div>
    </div>
  );
}

export default memo(Billboard);
