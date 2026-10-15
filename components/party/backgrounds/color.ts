// Small color helpers for the canvas scenes. Scenes take the album theme's
// colors and re-tone them (night sky, glowing windows) so every scene follows
// the cover while keeping its own mood.

import { hexToRgb, rgbToHsl } from "@/lib/huelix-palette-toolkit";

export interface ScenePalette {
  c1: string; // theme.gradient[0]
  c2: string;
  c3: string;
  accent: string;
  surface: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Same hue, new lightness (0-100), saturation scaled; returns rgba(). */
export function tone(hex: string, l: number, satMul = 1, alpha = 1): string {
  const c = hexToRgb(hex) ?? { r: 128, g: 128, b: 128 };
  const { h, s } = rgbToHsl(c.r, c.g, c.b);
  const [r, g, b] = hslToRgb(h, clamp(s * satMul, 0, 100), clamp(l, 0, 100));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Keep the color, clamp its lightness into [lo, hi] and set alpha. */
export function glow(hex: string, alpha = 1, lo = 55, hi = 78): string {
  const c = hexToRgb(hex) ?? { r: 128, g: 128, b: 128 };
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  const [r, g, b] = hslToRgb(h, clamp(Math.max(s, 55), 0, 100), clamp(l, lo, hi));
  return `rgba(${r},${g},${b},${alpha})`;
}

export function alpha(hex: string, a: number): string {
  const c = hexToRgb(hex) ?? { r: 128, g: 128, b: 128 };
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Linear blend between two hex colors (t = 0..1). */
export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a) ?? { r: 0, g: 0, b: 0 };
  const y = hexToRgb(b) ?? { r: 0, g: 0, b: 0 };
  return toHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
}

export function mixPalette(a: ScenePalette, b: ScenePalette, t: number): ScenePalette {
  return {
    c1: mixHex(a.c1, b.c1, t),
    c2: mixHex(a.c2, b.c2, t),
    c3: mixHex(a.c3, b.c3, t),
    accent: mixHex(a.accent, b.accent, t),
    surface: mixHex(a.surface, b.surface, t),
  };
}

/** Deterministic random numbers so a scene looks the same every time it's drawn. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hslHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, clamp(s, 0, 100), clamp(l, 0, 100));
  return toHex(r, g, b);
}

/** tone() as a hex string, for libraries that want hex. */
export function toneHex(hex: string, l: number, satMul = 1): string {
  const c = hexToRgb(hex) ?? { r: 128, g: 128, b: 128 };
  const { h, s } = rgbToHsl(c.r, c.g, c.b);
  return hslHex(h, s * satMul, l);
}

/** glow() as a hex string: vivid, mid-bright version of the color. */
export function glowHex(hex: string, lo = 55, hi = 72): string {
  const c = hexToRgb(hex) ?? { r: 128, g: 128, b: 128 };
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  return hslHex(h, Math.max(s, 60), clamp(l, lo, hi));
}
