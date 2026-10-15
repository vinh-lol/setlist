"use client";

// Backgrounds built on outside effect libraries (see the "Effects research" tab
// in the plan doc):
//   React Bits (MIT + Commons Clause, copied into ./reactbits): Night drive
//   (Hyperspeed), Galaxy, Prism burst, Liquid chrome, Aurora, Silk, Light rays
//   Paper Shaders (Apache-2.0, npm): Mesh gradient, Fluted glass cover,
//   Halftone cover
// Each is loaded on demand (only the one in use is downloaded), takes its colors
// from the current album, and follows the shared Motion slider. Colors and
// speed are eased so song changes fade and speed changes glide.

import dynamic from "next/dynamic";
import { memo, type ReactNode } from "react";
import type { BackgroundType } from "@/lib/display/config";
import { glowHex, toneHex, type ScenePalette } from "./color";
import { useEasedNumber, useEasedPalette } from "./easing";

const Hyperspeed = dynamic(() => import("./reactbits/Hyperspeed"), { ssr: false });
const Galaxy = dynamic(() => import("./reactbits/Galaxy"), { ssr: false });
const PrismaticBurst = dynamic(() => import("./reactbits/PrismaticBurst"), { ssr: false });
const LiquidChrome = dynamic(() => import("./reactbits/LiquidChrome"), { ssr: false });
const Aurora = dynamic(() => import("./reactbits/Aurora"), { ssr: false });
const Silk = dynamic(() => import("./reactbits/Silk"), { ssr: false });
const LightRays = dynamic(() => import("./reactbits/LightRays"), { ssr: false });
const MeshGradient = dynamic(() => import("@paper-design/shaders-react").then((m) => m.MeshGradient), { ssr: false });
const FlutedGlass = dynamic(() => import("@paper-design/shaders-react").then((m) => m.FlutedGlass), { ssr: false });
const HalftoneDots = dynamic(() => import("@paper-design/shaders-react").then((m) => m.HalftoneDots), { ssr: false });

export const LIBRARY_BACKGROUNDS = ["drive", "galaxy", "prism", "chrome", "aurora", "silk", "rays", "mesh", "fluted", "halftone"] as const;
export type LibraryBackgroundType = (typeof LIBRARY_BACKGROUNDS)[number];
export const isLibraryBackground = (t: BackgroundType): t is LibraryBackgroundType =>
  (LIBRARY_BACKGROUNDS as readonly string[]).includes(t);

// Paper Shaders render at device pixel ratio by default; cap at 1080p so a
// 4K TV doesn't shade 4x the pixels.
const PAPER = { minPixelRatio: 1, maxPixelCount: 1920 * 1080, style: { position: "absolute", inset: 0 }, width: "100%", height: "100%" } as const;

// shade = a dark layer over the effect so white text stays readable on
// bright content (the cover-based effects show the cover nearly as-is).
function Fill({ bg, shade = 0, children }: { bg: string; shade?: number; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden" style={{ background: bg }} aria-hidden="true">
      {children}
      {shade > 0 && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${shade})` }} />}
    </div>
  );
}

function LibraryBackground({
  type,
  palette: target,
  speed: targetSpeed,
  albumArt,
}: {
  type: LibraryBackgroundType;
  palette: ScenePalette;
  speed: number;
  albumArt?: string;
}) {
  const p = useEasedPalette(target);
  const m = useEasedNumber(targetSpeed); // motion multiplier, 0 = paused
  const glows = [glowHex(p.c1), glowHex(p.c2), glowHex(p.c3)];
  const night = toneHex(p.c1, 5, 0.6);

  switch (type) {
    case "drive":
      return (
        <Fill bg={night}>
          <Hyperspeed
            speed={m}
            interactive={false}
            headColors={[glowHex(p.c2, 70, 85), glowHex(p.c3, 65, 80), "#FFFFFF"]}
            tailColors={[glowHex(p.accent, 50, 62), glowHex(p.c1, 45, 60), glowHex(p.c3, 50, 62)]}
            poleColors={[glowHex(p.accent, 60, 75)]}
            roadColor={toneHex(p.c1, 4, 0.5)}
            background={night}
          />
        </Fill>
      );
    case "galaxy":
      return (
        <Fill bg={night}>
          <Galaxy speed={m} starSpeed={0.5 * m} starColors={glows} density={1.2} glowIntensity={0.35} mouseInteraction={false} mouseRepulsion={false} clickWarp={false} />
        </Fill>
      );
    case "prism":
      return (
        <Fill bg={night}>
          <PrismaticBurst colors={[glowHex(p.c1, 62, 76), glowHex(p.c2, 62, 76), glowHex(p.c3, 62, 76), glowHex(p.accent, 62, 76)]} speed={0.5 * m} intensity={2.6} glow={1} mouseInteraction={false} clickBurst={false} />
        </Fill>
      );
    case "chrome":
      return (
        <Fill bg={night}>
          <LiquidChrome color={toneHex(p.c2, 32, 0.9)} speed={0.2 * m} amplitude={0.3} interactive={false} />
        </Fill>
      );
    case "aurora":
      return (
        <Fill bg={night}>
          <Aurora colorStops={glows} speed={m} amplitude={1} blend={0.55} mouseInteraction={false} />
        </Fill>
      );
    case "silk":
      return (
        <Fill bg={night}>
          <Silk color={toneHex(p.c2, 34, 0.9)} sheenColor={glowHex(p.accent, 70, 85)} speed={4 * m} mouseInteraction={false} clickRipple={false} />
        </Fill>
      );
    case "rays":
      return (
        <Fill bg={night}>
          <LightRays raysOrigin="top-center" raysColor={glowHex(p.accent, 62, 78)} raysSpeed={m} intensity={1} followMouse={false} cursorShadow={false} clickPulse={false} />
        </Fill>
      );
    case "mesh":
      return (
        <Fill bg={p.surface}>
          <MeshGradient {...PAPER} colors={[p.c1, p.c2, p.c3, p.accent]} speed={0.6 * m} distortion={0.8} swirl={0.15} grainOverlay={0.06} />
        </Fill>
      );
    case "fluted":
      return (
        <Fill bg={night} shade={0.42}>
          {albumArt && (
            <FlutedGlass {...PAPER} image={albumArt} fit="cover" speed={0} colorBack="#00000000" shape="lines" distortionShape="prism" size={0.6} distortion={0.6} blur={0.25} highlights={0.1} shadows={0.35} />
          )}
        </Fill>
      );
    case "halftone":
      return (
        <Fill bg={night} shade={0.5}>
          {albumArt && (
            <HalftoneDots {...PAPER} image={albumArt} fit="cover" speed={0} originalColors colorBack={night} size={0.6} radius={1.1} contrast={0.3} grainOverlay={0} />
          )}
        </Fill>
      );
  }
}

export default memo(LibraryBackground);
