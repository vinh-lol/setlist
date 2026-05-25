import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "setlists");
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tracks, partyStartMs } = body;
  if (!Array.isArray(tracks) || typeof partyStartMs !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await mkdir(DATA_DIR, { recursive: true });
  const code = generateCode();
  const filePath = path.join(DATA_DIR, `${code}.json`);
  await writeFile(filePath, JSON.stringify({ tracks, playedTracks: [], partyStartMs, createdAt: Date.now() }));

  return NextResponse.json({ code });
}
