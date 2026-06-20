import { NextRequest, NextResponse } from "next/server";
import { addRequest, takeRequests } from "@/lib/partyStore";

function safeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

// Host polls this to drain pending guest requests (consume-once).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  return NextResponse.json({ requests: takeRequests(safeCode(code)) });
}

// Guest submits a track to the host's queue.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ ok: false }, { status: 400 });
  addRequest(safeCode(code), {
    id: String(body.id),
    name: String(body.name ?? ""),
    artists: Array.isArray(body.artists) ? body.artists.map(String) : [],
    albumArt: String(body.albumArt ?? ""),
    at: Date.now(),
  });
  return NextResponse.json({ ok: true });
}
