import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const SETLISTS_DIR = path.join(process.cwd(), "data", "setlists");
const USERS_DIR = path.join(process.cwd(), "data", "users");
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  let c = "";
  for (let i = 0; i < 6; i++) c += CHARS[Math.floor(Math.random() * CHARS.length)];
  return c;
}

function userFile(userId: string) {
  return path.join(USERS_DIR, `${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

async function readUserIndex(userId: string): Promise<SavedSetlistMeta[]> {
  try {
    const raw = await readFile(userFile(userId), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeUserIndex(userId: string, index: SavedSetlistMeta[]) {
  await mkdir(USERS_DIR, { recursive: true });
  await writeFile(userFile(userId), JSON.stringify(index));
}

interface SavedSetlistMeta {
  code: string;
  name: string;
  partyStartMs: number;
  trackCount: number;
  createdAt: number;
}

// GET /api/my-setlists — list saved setlists for the signed-in user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const index = await readUserIndex(session.userId);
  return NextResponse.json(index);
}

// POST /api/my-setlists — save a new named setlist
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, tracks, playedTracks, partyStartMs } = body;
  if (!name || !Array.isArray(tracks) || typeof partyStartMs !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await mkdir(SETLISTS_DIR, { recursive: true });
  const code = generateCode();
  await writeFile(
    path.join(SETLISTS_DIR, `${code}.json`),
    JSON.stringify({ tracks, playedTracks: playedTracks ?? [], partyStartMs, createdAt: Date.now() })
  );

  const index = await readUserIndex(session.userId);
  const meta: SavedSetlistMeta = {
    code,
    name: name.trim(),
    partyStartMs,
    trackCount: tracks.length,
    createdAt: Date.now(),
  };
  await writeUserIndex(session.userId, [meta, ...index]);

  return NextResponse.json({ code });
}
