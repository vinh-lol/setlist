"use client";

import dynamic from "next/dynamic";
import { rgba, type AlbumTheme } from "@/lib/albumTheme";
import type { DisplayConfig } from "@/lib/display/config";

// WebGL/three — client only.
const GradientBackground = dynamic(() => import("@/components/GradientBackground"), { ssr: false });

// Album-coloured moving gradient behind the dashboard, softened by a blur layer.
// Other background types (cover, solid, image) arrive with the settings drawer.
export default function DisplayBackground({ theme, background }: { theme: AlbumTheme; background: DisplayConfig["background"] }) {
  if (theme.gradient.length === 0) return null;
  return (
    <>
      {/* Album-coloured moving gradient (sharp WebGL canvas) ... */}
      <div className="absolute inset-0 z-0">
        <GradientBackground colors={theme.gradient} shader={background.shader} />
      </div>
      {/* ... softened by a backdrop blur layer so it recedes into ambience
          (blurring the canvas via CSS filter would blank it in Chromium). */}
      <div
        className="absolute inset-0 z-0"
        style={{ backdropFilter: `blur(${background.blur}px)`, WebkitBackdropFilter: `blur(${background.blur}px)`, background: rgba(theme.surface, background.dim) }}
      />
    </>
  );
}
