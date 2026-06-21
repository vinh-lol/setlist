// Drives a Govee light to match the album-adaptive gradient. The /party page
// POSTs its current colors here on each song change; we forward them to the
// Govee cloud (key stays server-side). GET lists the account's devices + the
// detected segment count, to help configure GOVEE_DEVICE / GOVEE_SKU.

import { listDevices, resolveTarget, syncColors } from "@/lib/govee";

export async function GET() {
  if (!process.env.GOVEE_API_KEY) {
    return Response.json({ configured: false, hint: "Set GOVEE_API_KEY (and optionally GOVEE_DEVICE/GOVEE_SKU)." });
  }
  try {
    const devices = await listDevices();
    const target = await resolveTarget(true);
    return Response.json({
      configured: true,
      target,
      devices: devices.map((d) => ({
        sku: d.sku,
        device: d.device,
        name: d.deviceName,
        segmentColor: !!d.capabilities?.some((c) => c.type === "devices.capabilities.segment_color_setting"),
      })),
    });
  } catch (e) {
    return Response.json({ configured: true, error: String(e) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  if (!process.env.GOVEE_API_KEY) {
    // Not an error from the page's perspective — Govee just isn't set up.
    return Response.json({ ok: false, reason: "not-configured" });
  }
  try {
    const { colors, accent } = (await req.json()) as { colors?: string[]; accent?: string };
    if (!Array.isArray(colors) && !accent) {
      return Response.json({ ok: false, reason: "no-colors" }, { status: 400 });
    }
    const result = await syncColors(colors ?? [], accent);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
