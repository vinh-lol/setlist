"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { rgba, type AlbumTheme } from "@/lib/albumTheme";
import type { ColorMode, DisplayConfig } from "@/lib/display/config";

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
// blur and dim apply on top of every type except solid. With a forced light or
// dark color mode, photo backgrounds (cover, image) are dimmed further toward
// the surface, since a bright cover would otherwise fight the forced theme.
export default function DisplayBackground({
  theme,
  background,
  albumArt,
  colorMode = "auto",
}: {
  theme: AlbumTheme;
  background: Background;
  albumArt?: string;
  colorMode?: ColorMode;
}) {
  if (background.type === "solid") return null;

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
        <GradientBackground colors={theme.gradient} shader={background.shader} />
      </div>
      {/* ... softened by a backdrop blur layer so it recedes into ambience
          (blurring the canvas via CSS filter would blank it in Chromium). */}
      <Veil theme={theme} background={background} />
    </>
  );
}

function Veil({ theme, background }: { theme: AlbumTheme; background: Background }) {
  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        backdropFilter: `blur(${background.blur}px)`,
        WebkitBackdropFilter: `blur(${background.blur}px)`,
        background: rgba(theme.surface, background.dim),
      }}
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
