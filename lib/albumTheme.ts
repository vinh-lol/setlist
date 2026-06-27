// Bridges the Huelix palette toolkit to the party dashboard: pulls a palette from
// an album-art URL (canvas → ImageData → the toolkit's pure extractor), runs the
// toolkit's role assignment (60-30-10), then maps the roles to a dashboard theme
// with WCAG contrast guards so text/accents stay legible on any cover.

import {
  extractPaletteFromImageData,
  medianCutQuantizeCounts,
  assignColorRoles,
  computeColorHierarchy,
  hexToRgb,
  rgbToHsl,
  hueDist,
  clamp,
  type HierarchyEntry,
  type Role,
} from "./huelix-palette-toolkit";

export interface AlbumTheme {
  surface: string; // page background  (Surface role)
  ink: string;     // body text        (Body text role)
  primary: string; // lead/title color (Primary role)
  accent: string;  // highlights/pops  (Accent role)
  support: string; // dividers/rest    (Support role)
  gradient: string[]; // 3 album colors for the moving background
  palette: string[];
  hierarchy: HierarchyEntry[];
}

export const DEFAULT_THEME: AlbumTheme = {
  surface: "#FFFFFF",
  ink: "#141414",
  primary: "#141414",
  accent: "#1A1A1A",
  support: "#E5E5E5",
  gradient: [],
  palette: [],
  hierarchy: [],
};

export function rgba(hex: string, a: number): string {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  const toHex = (v: number) => clamp(v, 0, 255).toString(16).padStart(2, "0");
  return "#" + (toHex(f(0)) + toHex(f(8)) + toHex(f(4))).toUpperCase();
}

function srgbLum(hex: string): number {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contrast(a: string, b: string): number {
  const hi = Math.max(srgbLum(a), srgbLum(b));
  const lo = Math.min(srgbLum(a), srgbLum(b));
  return (hi + 0.05) / (lo + 0.05);
}

function desaturate(hex: string, factor: number): string {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  return hslToHex(h, s * factor, l);
}

// Step a color's lightness (keeping hue/sat) until it clears `target` contrast on bg.
function ensureContrast(hex: string, bg: string, target: number): string {
  if (contrast(hex, bg) >= target) return hex;
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const { h, s } = rgbToHsl(c.r, c.g, c.b);
  let { l } = rgbToHsl(c.r, c.g, c.b);
  const bgLight = srgbLum(bg) > 0.4;
  for (let i = 0; i < 24; i++) {
    l = clamp(l + (bgLight ? -4 : 4), 0, 100);
    const cand = hslToHex(h, s, l);
    if (contrast(cand, bg) >= target) return cand;
    if (l <= 0 || l >= 100) break;
  }
  return bgLight ? "#111111" : "#FAFAFA";
}

// "Iconicness" of a color: high chroma at a usable mid lightness scores best,
// near-black / near-white / washed-out tones score ~0. Lets a small but vivid
// pop on an otherwise monochrome cover win the accent.
function chromaScore(hex: string): number {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const { s, l } = rgbToHsl(c.r, c.g, c.b);
  if (l < 14 || l > 88) return -1; // near black/white — not a pop
  const lightWeight = Math.max(0.15, 1 - Math.abs(l - 55) / 55); // favour mid lightness
  return (s / 100) * lightWeight;
}

// Shift a color's lightness by `dl` (percentage points), keeping hue/sat.
function shade(hex: string, dl: number): string {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  return hslToHex(h, s, clamp(l + dl, 0, 100));
}

// A hue counts toward the gradient only if colors of that hue cover at least this
// share of the cover. Filters out tiny vivid pops (logos, stickers, a fleck of
// clothing) that used to win the background on vividness alone.
const MIN_HUE_SHARE = 0.04;

// How much of the cover (0–1) is taken up by reasonably-saturated pixels near
// `hue`. Near-grey buckets are ignored so a brown/neutral mass can't inflate a
// hue's coverage. `counts` is the coverage-weighted candidate list.
function hueCoverage(hue: number, counts: { hex: string; n: number }[], total: number): number {
  let sum = 0;
  for (const { hex, n } of counts) {
    const c = hexToRgb(hex);
    if (!c) continue;
    const { h, s } = rgbToHsl(c.r, c.g, c.b);
    if (s < 12) continue; // a near-grey pixel has no real hue to credit
    if (hueDist(h, hue) <= 22) sum += n;
  }
  return sum / total;
}

// Three hue-distinct, reasonably-saturated colors for the moving gradient. Still
// ranked by vividness (so the background keeps its pop and never goes
// black/white/brown-dominated), but a hue must clear MIN_HUE_SHARE coverage to be
// eligible — that's what kills the odd minority-color picks. Fills with lightness
// variants of the accent on covers without three distinct, prominent hues.
function gradientColors(
  palette: string[],
  candidates: string[],
  accent: string,
  counts: { hex: string; n: number }[],
): string[] {
  const total = counts.reduce((s, c) => s + c.n, 0) || 1;
  const pool = Array.from(new Set([...candidates, ...palette]));
  const ranked = pool
    .map((h) => ({ h, score: chromaScore(h) }))
    .filter((x) => x.score > 0)
    .filter((x) => {
      const c = hexToRgb(x.h);
      return c ? hueCoverage(rgbToHsl(c.r, c.g, c.b).h, counts, total) >= MIN_HUE_SHARE : false;
    })
    .sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  for (const { h } of ranked) {
    if (picked.length >= 3) break;
    const c = hexToRgb(h);
    if (!c) continue;
    const hue = rgbToHsl(c.r, c.g, c.b).h;
    const distinct = picked.every((p) => {
      const pc = hexToRgb(p)!;
      return hueDist(rgbToHsl(pc.r, pc.g, pc.b).h, hue) > 25;
    });
    if (distinct) picked.push(h);
  }

  while (picked.length < 3) {
    const variants = [accent, shade(accent, 18), shade(accent, -18)];
    picked.push(variants[picked.length] ?? accent);
  }
  return picked.slice(0, 3);
}

// Most vivid candidate, if any clears a minimum saturation to count as "iconic".
function pickVivid(candidates: string[], minSat = 28): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const h of candidates) {
    const sc = chromaScore(h);
    if (sc > bestScore) { bestScore = sc; best = h; }
  }
  if (!best) return null;
  const c = hexToRgb(best) ?? { r: 0, g: 0, b: 0 };
  return rgbToHsl(c.r, c.g, c.b).s >= minSat ? best : null;
}

// Album-art URL -> palette (for roles) + a wider candidate list (for the vivid
// pick), each candidate carrying its pixel coverage so the gradient can weight
// by how much of the cover a color actually occupies.
export function analyzeAlbum(
  url: string,
  maxDim = 160,
): Promise<{ palette: string[]; candidates: string[]; counts: { hex: string; n: number }[] }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("no 2d context")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const data = ctx.getImageData(0, 0, w, h);
        const counts = medianCutQuantizeCounts(data, 32); // wider net to catch minority pops
        resolve({
          palette: extractPaletteFromImageData(data).colors,
          candidates: counts.map((c) => c.hex),
          counts,
        });
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

export function buildTheme(
  hexes: string[],
  candidates: string[] = [],
  counts: { hex: string; n: number }[] = [],
): AlbumTheme {
  if (!hexes.length) return DEFAULT_THEME;

  const hierarchy = computeColorHierarchy(hexes);
  const roles = assignColorRoles(hexes);
  const byRole = (r: Role) => roles.find((x) => x.role === r)?.hex;

  const sortedByL = [...hexes].sort((a, b) => srgbLum(a) - srgbLum(b));
  const lightest = sortedByL[sortedByL.length - 1];
  const darkest = sortedByL[0];

  // Surface: the toolkit's Surface role (lightest tone) or the lightest available,
  // tamed so a saturated cover doesn't become a neon canvas.
  let surface = byRole("Surface") ?? lightest;
  surface = desaturate(surface, 0.55);
  const bgLight = srgbLum(surface) > 0.45;

  // Ink: Body text role if it reads on the surface, else the opposite extreme.
  let ink = byRole("Body text") ?? (bgLight ? darkest : lightest);
  if (!ink || contrast(ink, surface) < 4.5) {
    ink = ensureContrast(ink ?? (bgLight ? "#111111" : "#FAFAFA"), surface, 5.5);
  }

  // Prefer the iconic standout color (from the wider candidate net) for the title
  // and accents; fall back to the role colors on truly monochrome covers.
  const vivid = pickVivid([...candidates, ...hexes]);
  const accentRaw = vivid ?? byRole("Accent") ?? byRole("Primary") ?? hexes[0];
  const primaryRaw = vivid ?? byRole("Primary") ?? byRole("Accent") ?? accentRaw;
  const accent = ensureContrast(accentRaw, surface, 3.4);
  const primary = ensureContrast(primaryRaw, surface, 3.6);
  const support = byRole("Support") ?? ink;
  const gradient = gradientColors(hexes, candidates, accent, counts.length ? counts : hexes.map((hex) => ({ hex, n: 1 })));

  return { surface, ink, primary, accent, support, gradient, palette: hexes, hierarchy };
}
