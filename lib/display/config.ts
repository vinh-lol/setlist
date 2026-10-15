// Display configuration for /party.
//
// Three separate things live here, on purpose:
//   - DisplayConfig:  the portable "look". Can be saved as a preset and shared.
//   - DeviceSettings: tied to one screen (e.g. lyric offset fixes THAT TV's
//                     speaker lag), so it never travels with a preset.
//   - PartyContent:   the words on screen (title, info rows). Content, not look.
//
// DEFAULT_CONFIG reproduces the dashboard exactly as it looked before settings
// existed. Anything loaded from storage is passed through normalizeConfig(),
// which fills missing keys from the defaults, so old saves keep working as the
// schema grows.
//
// Every field is honored by the renderers except layout.preset (only
// "classic" exists so far: lyrics layout, or the hero layout when there are no
// synced lyrics) and widgets.requestQr (arrives with the guest-request card).

import { LYRIC_FONT_IDS, type LyricFontId } from "./fonts";
export type ColorSource = "album" | "fixed";
export type ColorMode = "auto" | "dark" | "light";
export type ColorIntensity = "muted" | "balanced" | "vivid";
export type BackgroundType =
  | "shader" | "soft" | "cover" | "solid" | "image"
  | "city" | "billboard" | "synthwave" | "bokeh" | "vinyl"
  // effect libraries (components/party/backgrounds/LibraryBackground.tsx)
  | "drive" | "galaxy" | "prism" | "chrome" | "aurora" | "silk" | "rays" | "marble" | "lava" | "dither" | "fluted" | "halftone" | "visualizer";
export const BACKGROUND_TYPES: BackgroundType[] = [
  "shader", "soft", "cover", "solid", "image", "city", "billboard", "synthwave", "bokeh", "vinyl",
  "drive", "galaxy", "prism", "chrome", "aurora", "silk", "rays", "marble", "lava", "dither", "fluted", "halftone", "visualizer",
];
export type ShaderShape = "waterPlane" | "plane" | "sphere";
export type LyricsMode = "auto" | "always" | "off";
export type LyricsReveal = "word" | "sweep" | "line";
export type LyricsFont = LyricFontId;
export type LyricsLayout = "scroll" | "focus";
export type LyricsEffect = "none" | "glow" | "outline" | "pop";
export type Size = "s" | "m" | "l";
export type LayoutPreset = "classic" | "hero" | "lyricsOnly" | "minimal";
export type PanelStyle = "glass" | "solid" | "none";
export type TitleFont = LyricFontId;
export type GoveeMode = "palette" | "accent";

export interface DisplayConfig {
  version: 1;
  color: {
    source: ColorSource;
    /** Used when source = "fixed": three colors the theme is built from, like a cover. */
    fixed: { colors: string[] };
    mode: ColorMode;
    intensity: ColorIntensity;
    /** Fade between song themes, in ms. */
    transitionMs: number;
  };
  background: {
    type: BackgroundType;
    shader: {
      shape: ShaderShape;
      speed: number;
      strength: number;
      density: number;
      frequency: number;
      brightness: number;
      grain: boolean;
    };
    /** Used when type = "image". */
    imageUrl: string;
    /** Motion speed for the animated scenes (city, starfield, vinyl...), 0 = paused. */
    speed: number;
    /** What the billboard city's billboard shows. */
    billboard: "cover" | "lyrics";
    /** Visualizer (Butterchurn): what it listens to, cover-color tint, when the look changes. */
    visualizer: { source: "mic" | "beat"; tint: boolean; change: "song" | "minute" | "never" };
    /** Backdrop blur over the background, in px. */
    blur: number;
    /** Surface-colored tint over the background, 0..1. */
    dim: number;
  };
  lyrics: {
    /** auto = show when time-synced lyrics exist, else the hero layout. */
    mode: LyricsMode;
    /** word = word by word, sweep = smooth karaoke fill, line = whole line at once. */
    reveal: LyricsReveal;
    font: LyricsFont;
    size: Size;
    /** scroll = current line plus what's coming; focus = one big line at a time. */
    layout: LyricsLayout;
    caps: boolean;
    align: "left" | "center";
    effect: LyricsEffect;
  };
  layout: { preset: LayoutPreset };
  panels: { style: PanelStyle };
  widgets: {
    nowPlaying: boolean;
    transport: boolean;
    /** count "auto" = 5 next to lyrics, 6 in the hero layout. */
    upNext: { show: boolean; count: number | "auto" };
    clock: { show: boolean; hour12: boolean; seconds: boolean; date: boolean };
    /** The whole right column (clock, date, title, info). */
    side: boolean;
    title: { show: boolean; font: TitleFont; divider: boolean };
    info: boolean;
    infoHeading: boolean;
    infoTimes: boolean;
    requestQr: boolean;
  };
  lights: { govee: { enabled: boolean; mode: GoveeMode } };
}

export interface DeviceSettings {
  version: 1;
  /** Lyric timing offset in ms. Negative pulls lyrics later to match TV/speaker lag. */
  lyricOffsetMs: number;
  activePresetId: string;
  /** Swap the WebGL shader and blurred glass for lighter options on weak TV browsers. */
  lowPower: boolean;
  /** Ask the browser to keep the screen from sleeping while /party is open. */
  keepAwake: boolean;
}

export interface InfoItem {
  label: string;
  time: string;
}

export interface PartyContent {
  version: 1;
  title: string;
  /** Auto-grown title height in px, kept constant across layout swaps and reloads. */
  titleHeight: number | null;
  info: InfoItem[];
}

export const DEFAULT_CONFIG: DisplayConfig = {
  version: 1,
  color: {
    source: "album",
    fixed: { colors: ["#2B1055", "#7597DE", "#FF4D8D"] },
    mode: "auto",
    intensity: "balanced",
    transitionMs: 700,
  },
  background: {
    type: "shader",
    shader: {
      shape: "waterPlane",
      speed: 0.3,
      strength: 1.6,
      density: 1.5,
      frequency: 5.5,
      brightness: 1.1,
      grain: false,
    },
    imageUrl: "",
    speed: 1,
    billboard: "cover",
    visualizer: { source: "mic", tint: false, change: "song" },
    blur: 10,
    dim: 0.12,
  },
  lyrics: { mode: "auto", reveal: "word", font: "bitcount", size: "m", layout: "scroll", caps: true, align: "left", effect: "none" },
  layout: { preset: "classic" },
  panels: { style: "glass" },
  widgets: {
    nowPlaying: true,
    transport: true,
    upNext: { show: true, count: "auto" },
    clock: { show: true, hour12: false, seconds: true, date: true },
    side: true,
    title: { show: true, font: "inter", divider: true },
    info: true,
    infoHeading: true,
    infoTimes: true,
    requestQr: false,
  },
  lights: { govee: { enabled: true, mode: "palette" } },
};

/** Matches the dashboard's original -600ms lyric lead. */
export const DEFAULT_LYRIC_OFFSET_MS = -600;

export const DEFAULT_DEVICE: DeviceSettings = {
  version: 1,
  lyricOffsetMs: DEFAULT_LYRIC_OFFSET_MS,
  activePresetId: "classic",
  lowPower: false,
  keepAwake: true,
};

export const DEFAULT_CONTENT: PartyContent = {
  version: 1,
  title: "",
  titleHeight: null,
  info: [{ label: "", time: "" }],
};

// ---- normalization -------------------------------------------------------

type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Deep-merge `input` over `base`, keeping only keys that exist in `base` and
 * only values whose type matches the default (arrays replace wholesale). Bad
 * or missing values fall back to the default, so a corrupt or outdated save
 * can never break the display.
 */
function mergeKnown<T>(base: T, input: unknown): T {
  if (!isPlain(base) || !isPlain(input)) return base;
  const out: Plain = { ...base };
  for (const key of Object.keys(base)) {
    const def = (base as Plain)[key];
    const val = input[key];
    if (val === undefined) continue;
    if (isPlain(def)) out[key] = mergeKnown(def, val);
    else if (Array.isArray(def)) out[key] = Array.isArray(val) ? val : def;
    else if (def === null) out[key] = val;
    else if (typeof val === typeof def) out[key] = val;
  }
  return out as T;
}

const oneOf = <T extends string>(v: T, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v) ? v : fallback;

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

const clampNum = (v: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;

export function normalizeConfig(input: unknown): DisplayConfig {
  const c = mergeKnown(structuredClone(DEFAULT_CONFIG), input);
  const d = DEFAULT_CONFIG;

  c.version = 1;
  c.color.source = oneOf(c.color.source, ["album", "fixed"], d.color.source);
  c.color.mode = oneOf(c.color.mode, ["auto", "dark", "light"], d.color.mode);
  c.color.intensity = oneOf(c.color.intensity, ["muted", "balanced", "vivid"], d.color.intensity);
  c.color.transitionMs = clampNum(c.color.transitionMs, 0, 5000);

  c.color.fixed.colors = c.color.fixed.colors.filter(isHex).slice(0, 3);
  while (c.color.fixed.colors.length < 3) c.color.fixed.colors.push(d.color.fixed.colors[c.color.fixed.colors.length]);
  // The basic Starfield was replaced by Galaxy.
  if ((c.background.type as string) === "stars") c.background.type = "galaxy";
  if ((c.background.type as string) === "mesh") c.background.type = "marble";
  c.background.type = oneOf(c.background.type, BACKGROUND_TYPES, d.background.type);
  c.background.speed = clampNum(c.background.speed, 0, 2);
  c.background.billboard = oneOf(c.background.billboard, ["cover", "lyrics"], d.background.billboard);
  c.background.visualizer.source = oneOf(c.background.visualizer.source, ["mic", "beat"], d.background.visualizer.source);
  c.background.visualizer.change = oneOf(c.background.visualizer.change, ["song", "minute", "never"], d.background.visualizer.change);
  c.background.visualizer.tint = typeof c.background.visualizer.tint === "boolean" ? c.background.visualizer.tint : d.background.visualizer.tint;
  c.background.shader.shape = oneOf(c.background.shader.shape, ["waterPlane", "plane", "sphere"], d.background.shader.shape);
  c.background.blur = clampNum(c.background.blur, 0, 60);
  c.background.dim = clampNum(c.background.dim, 0, 1);

  c.lyrics.mode = oneOf(c.lyrics.mode, ["auto", "always", "off"], d.lyrics.mode);
  c.lyrics.reveal = oneOf(c.lyrics.reveal, ["word", "sweep", "line"], d.lyrics.reveal);
  c.lyrics.font = oneOf(c.lyrics.font, LYRIC_FONT_IDS, d.lyrics.font);
  c.lyrics.layout = oneOf(c.lyrics.layout, ["scroll", "focus"], d.lyrics.layout);
  c.lyrics.caps = typeof c.lyrics.caps === "boolean" ? c.lyrics.caps : d.lyrics.caps;
  c.lyrics.align = oneOf(c.lyrics.align, ["left", "center"], d.lyrics.align);
  c.lyrics.effect = oneOf(c.lyrics.effect, ["none", "glow", "outline", "pop"], d.lyrics.effect);
  c.lyrics.size = oneOf(c.lyrics.size, ["s", "m", "l"], d.lyrics.size);

  c.layout.preset = oneOf(c.layout.preset, ["classic", "hero", "lyricsOnly", "minimal"], d.layout.preset);
  // "liquid" and "frosted" were merged into "glass" (they looked the same).
  const legacyPanel = c.panels.style as string;
  if (legacyPanel === "liquid" || legacyPanel === "frosted") c.panels.style = "glass";
  c.panels.style = oneOf(c.panels.style, ["glass", "solid", "none"], d.panels.style);

  const count = (input as { widgets?: { upNext?: { count?: unknown } } } | null)?.widgets?.upNext?.count;
  c.widgets.upNext.count =
    typeof count === "number" && Number.isFinite(count) ? clampNum(Math.round(count), 0, 6) : "auto";
  c.widgets.title.font = oneOf(c.widgets.title.font, LYRIC_FONT_IDS, d.widgets.title.font);
  c.lights.govee.mode = oneOf(c.lights.govee.mode, ["palette", "accent"], d.lights.govee.mode);

  return c;
}

export function normalizeDevice(input: unknown): DeviceSettings {
  const s = mergeKnown(structuredClone(DEFAULT_DEVICE), input);
  s.version = 1;
  if (!Number.isFinite(s.lyricOffsetMs)) s.lyricOffsetMs = DEFAULT_LYRIC_OFFSET_MS;
  return s;
}

export function normalizeContent(input: unknown): PartyContent {
  const s = mergeKnown(structuredClone(DEFAULT_CONTENT), input);
  s.version = 1;
  // A height of 0 or less is never right (it came from measuring a detached
  // textarea); treat it as unknown so the title re-measures.
  if (s.titleHeight !== null && !(typeof s.titleHeight === "number" && Number.isFinite(s.titleHeight) && s.titleHeight > 0)) {
    s.titleHeight = null;
  }
  s.info = s.info
    .filter(isPlain)
    .map((r) => ({ label: String(r.label ?? ""), time: String(r.time ?? "") }));
  return s;
}

/**
 * The config the display actually renders. Device settings can override the
 * look without changing what's saved: low-power mode trades the WebGL shader
 * for the CSS soft gradient and blurred glass for solid panels, the two most
 * expensive things to draw on a TV.
 */
export function effectiveConfig(config: DisplayConfig, device: DeviceSettings): DisplayConfig {
  let c = config;
  // Night scenes are dark by nature: with color on Auto, use the dark theme so
  // text and panels are light-on-dark instead of following a bright cover.
  if (c.color.mode === "auto" && NIGHT_BACKGROUNDS.includes(c.background.type)) {
    c = { ...c, color: { ...c.color, mode: "dark" } };
  }
  if (device.lowPower) {
    c = {
      ...c,
      background: { ...c.background, type: c.background.type === "shader" ? "soft" : c.background.type },
      panels: { ...c.panels, style: c.panels.style === "glass" ? "solid" : c.panels.style },
    };
  }
  return c;
}

/** Backgrounds that are night scenes (see effectiveConfig). */
export const NIGHT_BACKGROUNDS: BackgroundType[] = [
  "city", "billboard", "synthwave", "bokeh", "vinyl",
  "drive", "galaxy", "prism", "chrome", "aurora", "silk", "rays", "marble", "lava", "dither", "fluted", "halftone", "visualizer",
];
