"use client";

// Still city at night with a lit billboard on the rooftops. The billboard shows
// the current cover and song, or the current lyric line. The skyline is the
// night-city scene frozen in place, so the only change is the billboard itself.

import { memo } from "react";
import type { SpotifyTrack } from "@/lib/types";
import CanvasScene from "./CanvasScene";
import { cityScene } from "./city";
import { alpha, glow, tone, type ScenePalette } from "./color";

function Billboard({
  palette,
  track,
  lyricLine,
  show,
}: {
  palette: ScenePalette;
  track: SpotifyTrack | null;
  lyricLine: string | null;
  show: "cover" | "lyrics";
}) {
  const screen = tone(palette.c1, 9, 0.7);
  const light = glow(palette.accent, 1, 62, 76);
  const line = show === "lyrics" ? lyricLine || track?.name || "" : "";
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <CanvasScene scene={cityScene} palette={palette} still stillAt={12} />
      {/* Light spilling onto the rooftops */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: "34%", width: "70vw", height: "50vh", background: `radial-gradient(ellipse at 50% 0%, ${glow(palette.accent, 0.22)} 0%, transparent 60%)` }}
      />
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: "9%", width: "min(52vw, 92vh)" }}>
        {/* the board */}
        <div
          className="relative w-full overflow-hidden flex items-center"
          style={{
            aspectRatio: "16 / 7",
            background: screen,
            border: "6px solid #0c0c0f",
            borderRadius: 6,
            boxShadow: `0 0 80px ${alpha(palette.accent, 0.45)}, 0 0 0 1px rgba(255,255,255,0.06) inset`,
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
          {/* scanlines + glare */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0 2px, transparent 2px 4px), linear-gradient(120deg, rgba(255,255,255,0.08), transparent 40%)" }} />
        </div>
        {/* legs */}
        <div className="flex justify-between px-[18%]">
          <div style={{ width: 10, height: "22vh", background: "#0c0c0f" }} />
          <div style={{ width: 10, height: "22vh", background: "#0c0c0f" }} />
        </div>
      </div>
    </div>
  );
}

export default memo(Billboard);
