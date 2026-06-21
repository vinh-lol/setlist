// Govee Developer API v2 (cloud) helper. Drives a Govee light to match the
// album-adaptive gradient colors. Server-side only — never expose GOVEE_API_KEY
// to the client. Colors arrive from the /party page (they're computed in the
// browser from the album art), and we forward them to Govee on each song change.
//
// Setup: GOVEE_API_KEY is required. GOVEE_DEVICE + GOVEE_SKU pick the light; if
// omitted we use the first device on the account. GOVEE_SEGMENTS optionally
// overrides the detected segment count.

import { hexToRgb } from "@/lib/huelix-palette-toolkit";

const BASE = "https://openapi.api.govee.com/router/api/v1";

interface GoveeCapability {
  type: string;
  instance: string;
  parameters?: {
    fields?: { fieldName: string; elementRange?: { min: number; max: number } }[];
  };
}
interface GoveeDevice {
  sku: string;
  device: string;
  deviceName?: string;
  capabilities?: GoveeCapability[];
}

export interface GoveeTarget {
  sku: string;
  device: string;
  name: string;
  segments: number; // 0 = no segment support (single color only)
}

// Resolved target is cached per warm instance so we don't re-list devices (a
// rate-limited call) on every color push.
let cachedTarget: GoveeTarget | null = null;

function key(): string | null {
  return process.env.GOVEE_API_KEY || null;
}

function headers(apiKey: string) {
  return { "Content-Type": "application/json", "Govee-API-Key": apiKey };
}

function rgbInt(hex: string): number {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return (c.r << 16) + (c.g << 8) + c.b;
}

export async function listDevices(): Promise<GoveeDevice[]> {
  const apiKey = key();
  if (!apiKey) throw new Error("GOVEE_API_KEY not set");
  const res = await fetch(`${BASE}/user/devices`, { headers: headers(apiKey), cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(`Govee list failed (${res.status}): ${JSON.stringify(json)}`);
  return (json.data ?? []) as GoveeDevice[];
}

function segmentCount(dev: GoveeDevice): number {
  const envOverride = Number(process.env.GOVEE_SEGMENTS);
  if (!Number.isNaN(envOverride) && envOverride > 0) return envOverride;
  const seg = dev.capabilities?.find((c) => c.type === "devices.capabilities.segment_color_setting");
  const field = seg?.parameters?.fields?.find((f) => f.fieldName === "segment");
  const max = field?.elementRange?.max;
  return typeof max === "number" ? max + 1 : 0;
}

export async function resolveTarget(force = false): Promise<GoveeTarget> {
  if (cachedTarget && !force) return cachedTarget;
  const devices = await listDevices();
  if (!devices.length) throw new Error("No Govee devices on this account");
  const wantDevice = process.env.GOVEE_DEVICE;
  const wantSku = process.env.GOVEE_SKU;
  const dev =
    (wantDevice && devices.find((d) => d.device === wantDevice && (!wantSku || d.sku === wantSku))) ||
    devices[0];
  cachedTarget = {
    sku: dev.sku,
    device: dev.device,
    name: dev.deviceName ?? dev.device,
    segments: segmentCount(dev),
  };
  return cachedTarget;
}

async function control(apiKey: string, target: GoveeTarget, capability: object) {
  const body = {
    requestId: crypto.randomUUID(),
    payload: { sku: target.sku, device: target.device, capability },
  };
  const res = await fetch(`${BASE}/device/control`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.code !== 200) {
    throw new Error(`Govee control failed (${res.status}): ${JSON.stringify(json)}`);
  }
}

// Split [0..segments-1] into `colors.length` contiguous groups so each gradient
// color paints an equal stretch of the strip.
function groupSegments(segments: number, parts: number): number[][] {
  const groups: number[][] = Array.from({ length: parts }, () => []);
  for (let i = 0; i < segments; i++) groups[Math.floor((i * parts) / segments)].push(i);
  return groups.filter((g) => g.length > 0);
}

// Push the gradient colors to the light. Spreads all colors across segments when
// supported; otherwise sets the single most-vivid color. `accent` is the page's
// chosen pop color, used as the single-color fallback.
export async function syncColors(colors: string[], accent?: string): Promise<{ mode: string; target: string }> {
  const apiKey = key();
  if (!apiKey) throw new Error("GOVEE_API_KEY not set");
  const palette = colors.filter(Boolean);
  if (!palette.length && !accent) throw new Error("No colors provided");
  const target = await resolveTarget();

  if (target.segments >= 2 && palette.length >= 2) {
    const groups = groupSegments(target.segments, palette.length);
    // One call per color group; sequential to stay friendly to rate limits.
    for (let i = 0; i < groups.length; i++) {
      await control(apiKey, target, {
        type: "devices.capabilities.segment_color_setting",
        instance: "segmentedColorRgb",
        value: { segment: groups[i], rgb: rgbInt(palette[i]) },
      });
    }
    return { mode: `segments(${target.segments})`, target: target.name };
  }

  const single = accent || palette[0];
  await control(apiKey, target, {
    type: "devices.capabilities.color_setting",
    instance: "colorRgb",
    value: rgbInt(single),
  });
  return { mode: "single", target: target.name };
}
