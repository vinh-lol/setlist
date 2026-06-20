/* ============================================================
   HUELIX PALETTE TOOLKIT — portable extract
   ------------------------------------------------------------
   Two self-contained features lifted from Huelix:

     1. Image -> palette extraction  (browser only; needs <canvas>)
        - extractPaletteFromImage(file)      // File -> hex[]
        - extractPaletteFromImageData(data)  // ImageData -> hex[]

     2. Colour hierarchy / role assignment  (pure; runs anywhere)
        - assignColorRoles(hexes)            // -> role per colour
        - computeColorHierarchy(hexes)       // -> 60-30-10 usage %

   No framework, no dependencies. TypeScript — to use as plain JS,
   delete the type annotations (everything after the `:` in params /
   returns and the `type` declarations).

   Colours are "#RRGGBB" strings throughout.
   ============================================================ */

/* ---------- types ---------- */
export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };
export type Role = "Surface" | "Body text" | "Primary" | "Accent" | "Support";
export type RoleAssignment = { hex: string; role: Role; reason: string };
export type HierarchyEntry = {
  hex: string;
  role: Role;
  reason: string;
  weight: number; // raw role weight before normalising
  pct: number;    // recommended share of the design, 0-100, sums to 100
  guide: string;  // plain-language "how to use it"
};

/* ============================================================
   COLOUR PRIMITIVES (shared by both features)
   ============================================================ */
export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function hexToRgb(hex: string): RGB | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return "#" + (h(r) + h(g) + h(b)).toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hexToHsl(hex: string): HSL {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return rgbToHsl(c.r, c.g, c.b);
}

/** Perceptual distance between two colours (redmean approximation, ~0–765). */
export function redmean(hex1: string, hex2: string): number {
  const a = hexToRgb(hex1), b = hexToRgb(hex2);
  if (!a || !b) return 0;
  return redmeanRgb(a.r, a.g, a.b, b.r, b.g, b.b);
}
function redmeanRgb(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** Shortest distance between two hues on the 0–360 wheel. */
export function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/* ============================================================
   1. IMAGE  ->  PALETTE          (browser only — needs <canvas>)
   ============================================================ */

const EXTRACT_DOWNSCALE = 160; // longest edge sampled, px
const MERGE_THRESHOLD = 60;    // redmean below which clusters merge
const QUANTIZE_COLORS = 16;    // median-cut buckets before merging

/** Median-cut quantization: ImageData -> up to `maxColors` average hexes. */
export function medianCutQuantize(imageData: ImageData, maxColors: number): string[] {
  const data = imageData.data;
  const pixels: number[][] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue; // skip mostly-transparent
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (!pixels.length) return [];

  function channelRanges(bucket: number[][]) {
    const min = [255, 255, 255], max = [0, 0, 0];
    for (const p of bucket) {
      for (let c = 0; c < 3; c++) {
        if (p[c] < min[c]) min[c] = p[c];
        if (p[c] > max[c]) max[c] = p[c];
      }
    }
    return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  }
  function averageColor(bucket: number[][]) {
    const sum = [0, 0, 0];
    for (const p of bucket) { sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; }
    const n = bucket.length;
    return rgbToHex(sum[0] / n, sum[1] / n, sum[2] / n);
  }

  const buckets: number[][][] = [pixels];
  while (buckets.length < maxColors) {
    let target = -1, targetChannel = 0, targetRange = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].length < 2) continue;
      const ranges = channelRanges(buckets[i]);
      for (let c = 0; c < 3; c++) {
        if (ranges[c] > targetRange) { targetRange = ranges[c]; target = i; targetChannel = c; }
      }
    }
    if (target === -1) break;
    const bucket = buckets[target];
    bucket.sort((a, b) => a[targetChannel] - b[targetChannel]);
    const mid = bucket.length >> 1;
    buckets.splice(target, 1, bucket.slice(0, mid), bucket.slice(mid));
  }
  return buckets.filter((b) => b.length).map(averageColor);
}

/** Agglomerative merge of near-identical colours, weighted by pixel count. */
function mergeSimilar(hexes: string[], threshold: number): { hex: string; n: number }[] {
  type Cluster = { r: number; g: number; b: number; n: number };
  const clusters: Cluster[] = hexes.map((h) => {
    const c = hexToRgb(h) ?? { r: 0, g: 0, b: 0 };
    return { r: c.r, g: c.g, b: c.b, n: 1 };
  });
  while (clusters.length > 1) {
    let mi = -1, mj = -1, minD = Infinity;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i], b = clusters[j];
        const d = redmeanRgb(a.r, a.g, a.b, b.r, b.g, b.b);
        if (d < minD) { minD = d; mi = i; mj = j; }
      }
    }
    if (minD >= threshold) break;
    const a = clusters[mi], b = clusters[mj], n = a.n + b.n;
    const merged: Cluster = {
      r: (a.r * a.n + b.r * b.n) / n,
      g: (a.g * a.n + b.g * b.n) / n,
      b: (a.b * a.n + b.b * b.n) / n,
      n,
    };
    clusters.splice(mj, 1);
    clusters.splice(mi, 1);
    clusters.push(merged);
  }
  return clusters.sort((x, y) => y.n - x.n).map((c) => ({ hex: rgbToHex(c.r, c.g, c.b), n: c.n }));
}

/**
 * Quantize + merge + share-based pick: keeps the dominant 3 colours, then a
 * 4th if it holds >=3% of the image and a 5th/6th if they hold >=6%. Caps at 6.
 */
export function extractPaletteFromImageData(data: ImageData): { colors: string[]; note: string } {
  const candidates = medianCutQuantize(data, QUANTIZE_COLORS);
  if (!candidates.length) return { colors: [], note: "" };
  const merged = mergeSimilar(candidates, MERGE_THRESHOLD);
  const total = merged.reduce((s, c) => s + c.n, 0) || 1;
  const picked: string[] = [];
  for (const c of merged) {
    if (picked.length >= 6) break;
    const share = c.n / total;
    if (picked.length < 3) picked.push(c.hex);
    else if (picked.length === 3 && share >= 0.03) picked.push(c.hex);
    else if (share >= 0.06) picked.push(c.hex);
  }
  const colors = picked.length ? picked : [merged[0].hex];
  const note =
    colors.length === 1
      ? "One dominant color found — add more if your brand uses them."
      : `Pulled ${colors.length} core colors — remove any that aren't central, or add one we missed.`;
  return { colors, note };
}

/**
 * Full browser pipeline: an image File -> palette. Downsamples to keep it fast,
 * draws to an offscreen canvas, reads pixels, and runs the extractor above.
 */
export function extractPaletteFromImage(
  file: File,
  maxDim: number = EXTRACT_DOWNSCALE,
): Promise<{ colors: string[]; note: string }> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please choose a JPG, PNG, or WEBP image."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.createElement("img");
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not available.")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const result = extractPaletteFromImageData(data);
        if (!result.colors.length) { reject(new Error("Could not read colors from that image.")); return; }
        resolve(result);
      };
      img.onerror = () => reject(new Error("Could not load that image."));
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   2. COLOUR HIERARCHY / ROLE ASSIGNMENT     (pure — runs anywhere)
   ============================================================ */

/**
 * Assign each colour a semantic role from its lightness / saturation, in the
 * order the colours were given (output order matches input order):
 *   Surface   — lightest tone (L >= 68), backgrounds
 *   Body text — darkest tone (L <= 42), type/UI text
 *   Primary   — most saturated remaining, lead brand colour
 *   Accent    — next saturated, ideally >22deg hue from Primary
 *   Support   — everything else (neutral filler / extra hue)
 */
export function assignColorRoles(hexes: string[]): RoleAssignment[] {
  const en = hexes.map((hex, i) => ({ hex, i, ...hexToHsl(hex) }));
  const byL = [...en].sort((a, b) => a.l - b.l);
  const byS = [...en].sort((a, b) => b.s - a.s);
  const lightest = byL[byL.length - 1];
  const darkest = byL[0];
  const A: Record<number, { role: Role; reason: string }> = {};

  if (lightest && lightest.l >= 68)
    A[lightest.i] = { role: "Surface", reason: "your lightest tone — backgrounds and breathing room." };
  if (darkest && darkest.l <= 42 && darkest.i !== lightest.i)
    A[darkest.i] = { role: "Body text", reason: "your darkest tone — anchors paragraphs and UI text." };

  const primary = byS.find((c) => !A[c.i]);
  if (primary)
    A[primary.i] = { role: "Primary", reason: "most saturated — the lead color for key actions and identity." };

  const accent =
    byS.find((c) => !A[c.i] && (!primary || hueDist(c.h, primary.h) > 22)) ||
    byS.find((c) => !A[c.i]);
  if (accent)
    A[accent.i] = { role: "Accent", reason: "a secondary pop — highlights and supporting moments." };

  en.forEach((c) => {
    if (!A[c.i])
      A[c.i] = {
        role: "Support",
        reason: c.s <= 12
          ? "low-chroma neutral — dividers, borders, and rest space."
          : "an extra hue — use sparingly so the system stays focused.",
      };
  });

  return en.map((c) => ({ hex: c.hex, role: A[c.i].role, reason: A[c.i].reason }));
}

/** Recommended share of the design per role, before normalising (60-30-10). */
const HIER_WEIGHT: Record<Role, number> = {
  Surface: 60, Primary: 24, "Body text": 8, Accent: 6, Support: 3,
};
const HIER_GUIDE: Record<Role, string> = {
  Surface: "Dominant — backgrounds and the canvas everything sits on.",
  Primary: "Lead brand color — headers, key buttons, identity moments.",
  "Body text": "Type and UI text — high-frequency but quiet.",
  Accent: "Accents only — highlights and small emphatic moments.",
  Support: "Sparingly — dividers, secondary fills, and rest space.",
};

/**
 * Turn a palette into a usage hierarchy: each colour gets a role and a
 * recommended percentage of the design (the 60-30-10 principle, normalised so
 * the percentages sum to 100). Sorted largest share first.
 */
export function computeColorHierarchy(hexes: string[]): HierarchyEntry[] {
  const roles = assignColorRoles(hexes);
  const weighted = roles.map((r) => ({ ...r, weight: HIER_WEIGHT[r.role] ?? 4 }));
  const total = weighted.reduce((s, r) => s + r.weight, 0) || 1;

  const ranked = weighted
    .map((r) => ({ ...r, pct: (r.weight / total) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .map((r) => ({ ...r, pct: Math.round(r.pct) }));

  // Fix rounding drift onto the biggest share so the total is exactly 100.
  const drift = 100 - ranked.reduce((s, r) => s + r.pct, 0);
  if (ranked.length) ranked[0].pct += drift;

  return ranked.map((r) => ({
    hex: r.hex,
    role: r.role,
    reason: r.reason,
    weight: r.weight,
    pct: r.pct,
    guide: HIER_GUIDE[r.role] ?? r.reason,
  }));
}
