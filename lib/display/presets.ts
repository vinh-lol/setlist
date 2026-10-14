// Presets: named DisplayConfigs. Five built-in looks ship with the app; your own
// are saved in this browser and can be exported/imported as JSON files to move
// them to another screen. A preset is only the look: title, info rows and
// device settings (lyric offset, low power) never travel with it.

import { DEFAULT_CONFIG, normalizeConfig, type DisplayConfig } from "./config";

export interface Preset {
  id: string;
  name: string;
  description?: string;
  builtIn: boolean;
  config: DisplayConfig;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

const preset = (id: string, name: string, description: string, patch: DeepPartial<DisplayConfig>): Preset => ({
  id,
  name,
  description,
  builtIn: true,
  config: normalizeConfig(deepMerge(DEFAULT_CONFIG, patch)),
});

function deepMerge<T>(base: T, patch: unknown): T {
  if (typeof base !== "object" || base === null || Array.isArray(base)) return (patch ?? base) as T;
  const out = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries((patch as Record<string, unknown>) ?? {})) {
    out[k] = typeof v === "object" && v !== null && !Array.isArray(v) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

export const BUILT_IN_PRESETS: Preset[] = [
  preset("classic", "Classic", "The original: 3D gradient, liquid glass, lyrics when a song has them.", {}),
  preset("lounge", "Lounge", "Blurred cover drifting slowly, muted colors, no lyrics.", {
    color: { intensity: "muted", transitionMs: 3000 },
    background: { type: "cover", blur: 14, dim: 0.2 },
    lyrics: { mode: "off" },
    panels: { style: "frosted" },
    widgets: { transport: false },
  }),
  preset("karaoke", "Karaoke", "Big lyrics front and center on a dark screen.", {
    color: { mode: "dark" },
    background: { dim: 0.3 },
    lyrics: { mode: "always", reveal: "word", font: "anton", size: "l" },
    widgets: { transport: false, info: false, title: { show: false }, clock: { show: false, date: false }, upNext: { count: 4 } },
  }),
  preset("club", "Club", "Dark, vivid and fast, with film grain.", {
    color: { mode: "dark", intensity: "vivid", transitionMs: 0 },
    background: { shader: { speed: 0.7, strength: 2.2, grain: true }, blur: 6 },
    panels: { style: "solid", radius: 12 },
    widgets: { transport: false },
  }),
  preset("minimal", "Minimal", "Calm and flat: charcoal and gold, no panels, no lyrics.", {
    color: { source: "fixed", fixed: { colors: ["#101114", "#1E2433", "#F2C14E"] }, mode: "dark", transitionMs: 3000 },
    background: { type: "soft", dim: 0.1 },
    lyrics: { mode: "off" },
    panels: { style: "none" },
    widgets: { transport: false, info: false, upNext: { count: 3 } },
  }),
];

// ---- your presets (localStorage) -------------------------------------------

const K_PRESETS = "display-presets";

export function loadUserPresets(): Preset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(K_PRESETS) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((p) => p && typeof p.id === "string" && typeof p.name === "string")
      .map((p) => ({ id: p.id, name: p.name.slice(0, 40), builtIn: false, config: normalizeConfig(p.config) }));
  } catch {
    return [];
  }
}

export function saveUserPresets(presets: Preset[]) {
  try {
    localStorage.setItem(K_PRESETS, JSON.stringify(presets.map(({ id, name, config }) => ({ id, name, config }))));
  } catch {}
}

export const newPresetId = () => `mine-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Same look? Compares normalized configs, so key order never matters. */
export function sameLook(a: DisplayConfig, b: DisplayConfig): boolean {
  return stable(normalizeConfig(a)) === stable(normalizeConfig(b));
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

// ---- files ------------------------------------------------------------------

const FILE_KIND = "setlist-display-look";

export function presetToFile(name: string, config: DisplayConfig): Blob {
  return new Blob([JSON.stringify({ kind: FILE_KIND, version: 1, name, config }, null, 2)], { type: "application/json" });
}

/** Reads a look file. Throws a readable message if it isn't one. */
export function presetFromFile(text: string): { name: string; config: DisplayConfig } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const d = data as { kind?: unknown; name?: unknown; config?: unknown };
  if (d?.kind !== FILE_KIND || typeof d.config !== "object") throw new Error("That file isn't a Setlist look.");
  const name = typeof d.name === "string" && d.name.trim() ? d.name.trim().slice(0, 40) : "Imported look";
  return { name, config: normalizeConfig(d.config) };
}
