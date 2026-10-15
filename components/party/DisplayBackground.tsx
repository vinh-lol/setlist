"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useMemo, useState } from "react";
import { rgba, type AlbumTheme } from "@/lib/albumTheme";
import type { ColorMode, DisplayConfig } from "@/lib/display/config";
import type { SpotifyTrack } from "@/lib/types";
import CanvasScene from "./backgrounds/CanvasScene";
import Billboard from "./backgrounds/Billboard";
import Vinyl from "./backgrounds/Vinyl";
import { cityScene } from "./backgrounds/city";
import { synthwaveScene } from "./backgrounds/synthwave";
import { bokehScene } from "./backgrounds/bokeh";
import type { ScenePalette } from "./backgrounds/color";
import type { Scene } from "./backgrounds/CanvasScene";

import LibraryBackground, { isLibraryBackground } from "./backgrounds/LibraryBackground";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CANVAS_SCENES: Record<"city" | "synthwave" | "bokeh", Scene<any>> = { city: cityScene, synthwave: synthwaveScene, bokeh: bokehScene };

// WebGL/three — client only.
const GradientBackground = dynamic(() => import("@/components/GradientBackground"), { ssr: false });

type Background = DisplayConfig["background"];

// Everything behind the panels. Types:
//   shader = album-coloured moving WebGL gradient (the original look)
//   soft   = the same three colors as slow-drifting CSS blobs; no WebGL, so
//            it's what low-power mode uses
//   cover  = the album cover itself, heavily blurred, slowly drifting
//   image  = your own image or GIF URL, treated the same way (cover if empty)
//   solid  = just the theme surface color (painted by the page root)
//   city, synthwave, stars, bokeh = canvas scenes (components/party/backgrounds)
//   billboard = still night city with a lit billboard (cover or lyric line)
//   vinyl  = spinning record with the cover as its label
// Scenes are night-time by nature, so their dim darkens instead of tinting.
// dim tints every type except solid. blur only does work for the 3D gradient:
// it's a full-screen backdrop blur, recomputed every frame, so the other types
// (already soft, or blurred once as an image) skip it. With a forced light or
// dark color mode, photo backgrounds (cover, image) are dimmed further toward
// the surface, since a bright cover would otherwise fight the forced theme.
function DisplayBackground({
  theme,
  background,
  albumArt,
  colorMode = "auto",
  track = null,
  lyricLine = null,
  playing = true,
  lowPower = false,
}: {
  theme: AlbumTheme;
  background: Background;
  albumArt?: string;
  colorMode?: ColorMode;
  track?: SpotifyTrack | null;
  lyricLine?: string | null;
  playing?: boolean;
  lowPower?: boolean;
}) {
  const palette = useMemo(() => scenePalette(theme), [theme]);
  if (background.type === "solid") return null;

  if (isLibraryBackground(background.type)) {
    return (
      <>
        <LibraryBackground type={background.type} palette={palette} speed={background.speed} albumArt={albumArt} />
        <Veil theme={theme} background={background} color="#000000" />
      </>
    );
  }
  if (background.type === "city" || background.type === "synthwave" || background.type === "bokeh") {
    return (
      <>
        <CanvasScene scene={CANVAS_SCENES[background.type]} palette={palette} speed={background.speed} fps={lowPower ? 15 : 30} />
        <Veil theme={theme} background={background} color="#000000" />
      </>
    );
  }
  if (background.type === "billboard") {
    return (
      <>
        <Billboard palette={palette} track={track} lyricLine={lyricLine} show={background.billboard} />
        <Veil theme={theme} background={background} color="#000000" />
      </>
    );
  }
  if (background.type === "vinyl") {
    return (
      <>
        <Vinyl palette={palette} track={track} playing={playing} speed={background.speed} />
        <Veil theme={theme} background={background} color="#000000" />
      </>
    );
  }

  if (background.type === "soft") {
    if (theme.gradient.length === 0) return null;
    const [c1, c2 = c1, c3 = c2] = theme.gradient;
    return (
      <>
        <div
          className="party-bg-img absolute inset-0 z-0"
          aria-hidden="true"
          style={{
            background: `radial-gradient(at 18% 28%, ${c1} 0, transparent 58%), radial-gradient(at 82% 18%, ${c2} 0, transparent 55%), radial-gradient(at 62% 88%, ${c3} 0, transparent 62%), ${theme.surface}`,
          }}
        />
        <Veil theme={theme} background={background} />
      </>
    );
  }

  if (background.type === "cover" || background.type === "image") {
    const src = background.type === "image" && background.imageUrl.trim() ? background.imageUrl.trim() : albumArt;
    if (!src) return null;
    return (
      <>
        <CrossfadeImage src={src} blur={24 + background.blur * 2} />
        <Veil theme={theme} background={colorMode === "auto" ? background : { ...background, dim: Math.max(background.dim, 0.55) }} />
      </>
    );
  }

  if (theme.gradient.length === 0) return null;
  return (
    <>
      {/* Album-coloured moving gradient (sharp WebGL canvas) ... */}
      <div className="absolute inset-0 z-0">
        <GradientBackground colors={theme.gradient} shader={background.shader} motion={background.speed} />
      </div>
      {/* ... softened by a backdrop blur layer so it recedes into ambience
          (blurring the canvas via CSS filter would blank it in Chromium). */}
      <Veil theme={theme} background={background} blur />
    </>
  );
}

// Scene colors from the theme; a monochrome theme falls back to its accent.
export function scenePalette(theme: AlbumTheme): ScenePalette {
  const g = theme.gradient;
  return { c1: g[0] ?? theme.accent, c2: g[1] ?? g[0] ?? theme.accent, c3: g[2] ?? g[1] ?? theme.accent, accent: theme.accent, surface: theme.surface };
}

function Veil({ theme, background, blur = false, color }: { theme: AlbumTheme; background: Background; blur?: boolean; color?: string }) {
  const b = blur && background.blur > 0 ? `blur(${background.blur}px)` : undefined;
  return (
    <div
      className="absolute inset-0 z-0"
      style={{ backdropFilter: b, WebkitBackdropFilter: b, background: rgba(color ?? theme.surface, background.dim) }}
    />
  );
}

// Keeps the previous image underneath while the next one fades in, so a song
// change never flashes the bare surface color.
function CrossfadeImage({ src, blur }: { src: string; blur: number }) {
  const [layers, setLayers] = useState<string[]>([src]);

  useEffect(() => {
    setLayers((prev) => (prev[prev.length - 1] === src ? prev : [...prev.slice(-1), src]));
    const t = setTimeout(() => setLayers((prev) => prev.slice(-1)), 1500);
    return () => clearTimeout(t);
  }, [src]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {layers.map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          className="party-bg-img absolute inset-0 h-full w-full object-cover"
          style={{ filter: `blur(${blur}px) saturate(1.25)` }}
        />
      ))}
    </div>
  );
}

// Memoized: the page re-renders ~10x a second for the playback clock, and this
// doesn't need to unless its own props change.
export default memo(DisplayBackground);
