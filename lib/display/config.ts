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
// Wired today (Phase 1): background.shader, background.blur, background.dim,
// color.transitionMs, lyrics.mode, panels.style (liquid | frosted),
// panels.radius, widgets.upNext.count, widgets.clock, widgets.title.font,
// lights.govee.enabled. The remaining fields are part of the contract and get
// honored as the settings drawer lands (Phase 3); until then renderers fall
// back to the default behavior.

export type ColorSource = "album" | "fixed";
export type ColorMode = "auto" | "dark" | "light";
export type ColorIntensity = "muted" | "balanced" | "vivid";
export type BackgroundType = "shader" | "cover" | "solid" | "image" | "off";
export type ShaderShape = "waterPlane" | "plane" | "sphere";
export type LyricsMode = "auto" | "always" | "off";
export type LyricsReveal = "word" | "line";
export type LyricsFont = "bitcount" | "anton" | "inter";
export type Size = "s" | "m" | "l";
export type LayoutPreset = "classic" | "hero" | "lyricsOnly" | "minimal";
export type PanelStyle = "liquid" | "frosted" | "solid" | "none";
export type TitleFont = "anton" | "inter";
export type GoveeMode = "palette" | "accent";

export interface DisplayConfig {
  version: 1;
  color: {
    source: ColorSource;
    /** Used when source = "fixed". */
    fixed: { surface: string; ink: string; accent: string; gradient: string[] };
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
    imageUrl: string;
    /** Backdrop blur over the background, in px. */
    blur: number;
    /** Surface-colored tint over the background, 0..1. */
    dim: number;
  };
  lyrics: {
    /** auto = show when time-synced lyrics exist, else the hero layout. */
    mode: LyricsMode;
    reveal: LyricsReveal;
    font: LyricsFont;
    size: Size;
  };
  layout: { preset: LayoutPreset };
  panels: { style: PanelStyle; radius: number };
  widgets: {
    nowPlaying: boolean;
    transport: boolean;
    /** count "auto" = 5 next to lyrics, 6 in the hero layout. */
    upNext: { show: boolean; count: number | "auto" };
    clock: { show: boolean; hour12: boolean; seconds: boolean; date: boolean };
    title: { show: boolean; font: TitleFont };
    info: boolean;
    requestQr: boolean;
  };
  lights: { govee: { enabled: boolean; mode: GoveeMode } };
}

export interface DeviceSettings {
  version: 1;
  /** Lyric timing offset in ms. Negative pulls lyrics later to match TV/speaker lag. */
  lyricOffsetMs: number;
  activePresetId: string;
  lowPower: boolean;
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
    fixed: { surface: "#101014", ink: "#F5F5F5", accent: "#FF4D8D", gradient: ["#2B1055", "#7597DE", "#FF4D8D"] },
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
    blur: 10,
    dim: 0.12,
  },
  lyrics: { mode: "auto", reveal: "word", font: "bitcount", size: "m" },
  layout: { preset: "classic" },
  panels: { style: "liquid", radius: 26 },
  widgets: {
    nowPlaying: true,
    transport: true,
    upNext: { show: true, count: "auto" },
    clock: { show: true, hour12: false, seconds: true, date: true },
    title: { show: true, font: "inter" },
    info: true,
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

  c.background.type = oneOf(c.background.type, ["shader", "cover", "solid", "image", "off"], d.background.type);
  c.background.shader.shape = oneOf(c.background.shader.shape, ["waterPlane", "plane", "sphere"], d.background.shader.shape);
  c.background.blur = clampNum(c.background.blur, 0, 60);
  c.background.dim = clampNum(c.background.dim, 0, 1);

  c.lyrics.mode = oneOf(c.lyrics.mode, ["auto", "always", "off"], d.lyrics.mode);
  c.lyrics.reveal = oneOf(c.lyrics.reveal, ["word", "line"], d.lyrics.reveal);
  c.lyrics.font = oneOf(c.lyrics.font, ["bitcount", "anton", "inter"], d.lyrics.font);
  c.lyrics.size = oneOf(c.lyrics.size, ["s", "m", "l"], d.lyrics.size);

  c.layout.preset = oneOf(c.layout.preset, ["classic", "hero", "lyricsOnly", "minimal"], d.layout.preset);
  c.panels.style = oneOf(c.panels.style, ["liquid", "frosted", "solid", "none"], d.panels.style);
  c.panels.radius = clampNum(c.panels.radius, 0, 48);

  const count = (input as { widgets?: { upNext?: { count?: unknown } } } | null)?.widgets?.upNext?.count;
  c.widgets.upNext.count =
    typeof count === "number" && Number.isFinite(count) ? clampNum(Math.round(count), 0, 6) : "auto";
  c.widgets.title.font = oneOf(c.widgets.title.font, ["anton", "inter"], d.widgets.title.font);
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
  if (s.titleHeight !== null && !(typeof s.titleHeight === "number" && Number.isFinite(s.titleHeight))) {
    s.titleHeight = null;
  }
  s.info = s.info
    .filter(isPlain)
    .map((r) => ({ label: String(r.label ?? ""), time: String(r.time ?? "") }));
  return s;
}
