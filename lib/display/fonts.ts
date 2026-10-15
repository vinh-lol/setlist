// Lyric fonts. Every font here is free to use (SIL Open Font License, from
// Google Fonts). Anton and Inter ship with the page through next/font and
// Bitcount through globals.css; the rest are fetched only when picked (or when
// the Lyrics tab is open, so its font previews render in their own type).

export const LYRIC_FONTS = [
  { id: "bitcount", name: "Pixel", family: '"Bitcount Single", ui-monospace, monospace', google: null },
  { id: "anton", name: "Condensed", family: "var(--font-display)", google: null },
  { id: "inter", name: "Clean", family: "var(--font-sans)", google: null },
  { id: "bebas", name: "Poster", family: '"Bebas Neue", sans-serif', google: "Bebas+Neue" },
  { id: "grotesk", name: "Grotesk", family: '"Space Grotesk", sans-serif', google: "Space+Grotesk:wght@700" },
  { id: "serif", name: "Serif", family: '"Playfair Display", serif', google: "Playfair+Display:ital,wght@1,800" },
  { id: "marker", name: "Marker", family: '"Permanent Marker", cursive', google: "Permanent+Marker" },
  { id: "hand", name: "Handwritten", family: '"Caveat", cursive', google: "Caveat:wght@700" },
  { id: "arcade", name: "Arcade", family: '"Press Start 2P", monospace', google: "Press+Start+2P" },
  { id: "sign", name: "Signage", family: '"Bungee", sans-serif', google: "Bungee" },
  { id: "mono", name: "Typewriter", family: '"Space Mono", monospace', google: "Space+Mono:wght@700" },
  { id: "neon", name: "Neon tube", family: '"Monoton", sans-serif', google: "Monoton" },
] as const;

export type LyricFontId = (typeof LYRIC_FONTS)[number]["id"];
export const LYRIC_FONT_IDS = LYRIC_FONTS.map((f) => f.id) as LyricFontId[];

/** Some faces read much bigger or smaller than others at the same size. */
export const FONT_SIZE_FIX: Partial<Record<LyricFontId, number>> = {
  arcade: 0.62,
  neon: 0.78,
  sign: 0.85,
  hand: 1.25,
  bebas: 1.12,
  mono: 0.85,
};

export function lyricFont(id: LyricFontId) {
  return LYRIC_FONTS.find((f) => f.id === id) ?? LYRIC_FONTS[0];
}

const loaded = new Set<string>();

/** Add a Google Fonts stylesheet for these fonts (once each). */
export function loadFonts(ids: LyricFontId[]) {
  if (typeof document === "undefined") return;
  const families = ids
    .map((id) => lyricFont(id).google)
    .filter((g): g is NonNullable<typeof g> => !!g && !loaded.has(g));
  if (!families.length) return;
  families.forEach((g) => loaded.add(g));
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
  document.head.appendChild(link);
}
