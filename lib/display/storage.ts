// localStorage persistence for the display, with a one-time migration from the
// original per-field keys. Every read goes through the normalizers in
// config.ts, so a corrupt or outdated value falls back to the defaults instead
// of breaking the dashboard. All access is wrapped in try/catch: storage can
// throw in private windows or when blocked.
//
// The legacy keys are read but never deleted, so rolling back to an older build
// still finds the title, info rows and lyric offset where it left them.

import {
  normalizeConfig,
  normalizeContent,
  normalizeDevice,
  type DeviceSettings,
  type DisplayConfig,
  type PartyContent,
} from "./config";

export const K_CONFIG = "display-config";
export const K_DEVICE = "display-device";
export const K_CONTENT = "party-content";

// Pre-config keys (see the original app/party/page.tsx).
const LEGACY = {
  title: "party-title",
  titleOld: "party-custom-text",
  titleH: "party-title-h",
  info: "party-info",
  lyricLead: "party-lyric-lead",
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  const raw = read(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const num = (raw: string | null): number | undefined => {
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
};

export function loadConfig(): DisplayConfig {
  return normalizeConfig(readJson(K_CONFIG));
}

export function loadDevice(): DeviceSettings {
  const saved = readJson(K_DEVICE);
  if (saved !== undefined) return normalizeDevice(saved);
  // Migrate the old lyric offset.
  return normalizeDevice({ lyricOffsetMs: num(read(LEGACY.lyricLead)) });
}

export function loadContent(): PartyContent {
  const saved = readJson(K_CONTENT);
  if (saved !== undefined) return normalizeContent(saved);
  // Migrate the old title, title height and info rows.
  const legacyInfo = readJson(LEGACY.info);
  return normalizeContent({
    title: read(LEGACY.title) ?? read(LEGACY.titleOld) ?? "",
    titleHeight: num(read(LEGACY.titleH)) ?? null,
    info: Array.isArray(legacyInfo) ? legacyInfo : undefined,
  });
}

export const saveConfig = (c: DisplayConfig) => write(K_CONFIG, c);
export const saveDevice = (d: DeviceSettings) => write(K_DEVICE, d);
export const saveContent = (c: PartyContent) => write(K_CONTENT, c);
