import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "setlists");

function safeCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const filePath = path.join(DATA_DIR, `${safeCode(code)}.json`);
  try {
    const content = await readFile(filePath, "utf-8");
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await req.json();
  const { tracks, playedTracks, partyStartMs } = body;

  if (!Array.isArray(tracks) || !Array.isArray(playedTracks) || typeof partyStartMs !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const filePath = path.join(DATA_DIR, `${safeCode(code)}.json`);
  await writeFile(filePath, JSON.stringify({ tracks, playedTracks, partyStartMs, updatedAt: Date.now() }));
  return NextResponse.json({ ok: true });
}
