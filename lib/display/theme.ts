// Turns the album theme + display config into what the dashboard paints with:
// CSS variables on the root, the glass class for panels, and the text halo.

import type { CSSProperties } from "react";
import { rgba, type AlbumTheme } from "@/lib/albumTheme";
import { hexToRgb } from "@/lib/huelix-palette-toolkit";
import type { DisplayConfig, PanelStyle } from "./config";

// Panel treatment per style (see .lg-panel and friends in globals.css):
// liquid = blur + SVG edge distortion, frosted = blur only (much lighter on
// TV GPUs), solid = opaque surface tint, none = no panel at all.
const PANEL_CLASS: Record<PanelStyle, string> = {
  liquid: "lg-panel lg-distort",
  frosted: "lg-panel",
  solid: "lg-panel lg-solid",
  none: "lg-panel lg-bare",
};
export function panelClass(style: PanelStyle): string {
  return PANEL_CLASS[style];
}

const LYRIC_FONT: Record<DisplayConfig["lyrics"]["font"], string | undefined> = {
  bitcount: undefined, // keep the :root default (Bitcount Single)
  anton: "var(--font-display)",
  inter: "var(--font-sans)",
};
export const LYRIC_SCALE: Record<DisplayConfig["lyrics"]["size"], number> = { s: 0.8, m: 1, l: 1.25 };

// A halo in the tone opposite the ink, so bare text stays legible over the
// live gradient (light glow under dark text, dark glow under light text).
export function glowFor(hex: string): string {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return lum > 0.5 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.5)";
}

export function textHalo(theme: AlbumTheme): string {
  const glow = glowFor(theme.ink);
  return `0 0 8px ${glow}, 0 0 2px ${glow}`;
}

export function themeCssVars(theme: AlbumTheme, config: DisplayConfig): CSSProperties {
  return {
    background: theme.surface,
    color: theme.ink,
    fontFamily: "var(--font-sans)",
    "--ink": theme.ink,
    "--accent": theme.accent,
    "--primary": theme.primary,
    "--ink-65": rgba(theme.ink, 0.65),
    "--ink-50": rgba(theme.ink, 0.5),
    "--ink-40": rgba(theme.ink, 0.4),
    "--ink-35": rgba(theme.ink, 0.35),
    "--ink-30": rgba(theme.ink, 0.3),
    "--ink-25": rgba(theme.ink, 0.25),
    "--ink-15": rgba(theme.ink, 0.15),
    "--ink-10": rgba(theme.ink, 0.1),
    "--ink-05": rgba(theme.ink, 0.05),
    "--glass-tint": rgba(theme.surface, 0.34),
    "--glass-rim": "rgba(255,255,255,0.22)",
    "--surface": theme.surface,
    "--panel-solid": rgba(theme.surface, 0.9),
    ...(LYRIC_FONT[config.lyrics.font] ? { "--font-lyric": LYRIC_FONT[config.lyrics.font] } : {}),
    "--panel-radius": `${config.panels.radius}px`,
    transitionDuration: `${config.color.transitionMs}ms`,
  } as CSSProperties;
}
