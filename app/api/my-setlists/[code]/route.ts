import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const USERS_DIR = path.join(process.cwd(), "data", "users");

function userFile(userId: string) {
  return path.join(USERS_DIR, `${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

// DELETE /api/my-setlists/[code] — remove from user's saved list
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const file = userFile(session.userId);
  try {
    const raw = await readFile(file, "utf-8");
    const index = JSON.parse(raw) as { code: string }[];
    await writeFile(file, JSON.stringify(index.filter((s) => s.code !== code)));
  } catch {
    // index missing — nothing to delete
  }
  return NextResponse.json({ ok: true });
}
