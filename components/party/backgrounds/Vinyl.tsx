"use client";

// A record spinning on the right edge with the cover as its label. Spins while
// music plays and stops when paused. Calm.

import { memo } from "react";
import type { SpotifyTrack } from "@/lib/types";
import { alpha, tone, type ScenePalette } from "./color";

function Vinyl({ palette, track, playing, speed }: { palette: ScenePalette; track: SpotifyTrack | null; playing: boolean; speed: number }) {
  const size = "min(96vh, 64vw)";
  const spin = speed > 0 ? `${(4 / speed).toFixed(2)}s` : "0s";
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true" style={{ background: `radial-gradient(circle at 78% 50%, ${tone(palette.c2, 16, 0.8)} 0%, ${tone(palette.c1, 5, 0.6)} 65%)` }}>
      <div className="absolute top-1/2" style={{ width: size, height: size, right: `calc(${size} * -0.32)`, transform: "translateY(-50%)" }}>
        <div
          className="vinyl-spin relative w-full h-full rounded-full"
          style={{
            animationDuration: spin,
            animationPlayState: playing && speed > 0 ? "running" : "paused",
            background: "repeating-radial-gradient(circle, #101012 0 2px, #18181b 2px 4px)",
            boxShadow: `0 40px 120px rgba(0,0,0,0.55), 0 0 0 2px ${alpha(palette.accent, 0.15)}`,
          }}
        >
          {/* sheen */}
          <div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 30deg, transparent 0 12%, rgba(255,255,255,0.08) 18%, transparent 26% 62%, rgba(255,255,255,0.06) 68%, transparent 76%)" }} />
          {/* label */}
          <div className="absolute rounded-full overflow-hidden" style={{ inset: "32%", background: tone(palette.accent, 40) }}>
            {track?.albumArt && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.albumArt} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="absolute rounded-full" style={{ inset: "49%", background: "#0a0a0c" }} />
        </div>
      </div>
    </div>
  );
}

export default memo(Vinyl);
