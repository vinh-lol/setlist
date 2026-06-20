// Guest-facing Spotify track search. Uses the app's client-credentials token
// (no user login needed), so guests can search without signing in.

import { NextRequest, NextResponse } from "next/server";

let appToken: { value: string; exp: number } | null = null;

async function getAppToken(): Promise<string | null> {
  if (appToken && Date.now() < appToken.exp) return appToken.value;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const data = await res.json();
  appToken = { value: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 };
  return appToken.value;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ tracks: [] });

  const token = await getAppToken();
  if (!token) return NextResponse.json({ tracks: [] }, { status: 500 });

  // limit capped at 10 — Spotify restricts client-credentials search for dev-mode apps.
  const r = await fetch(
    `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!r.ok) return NextResponse.json({ tracks: [] });
  const data = await r.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracks = (data.tracks?.items ?? []).map((t: any) => ({
    id: t.id,
    name: t.name,
    artists: (t.artists ?? []).map((a: { name: string }) => a.name),
    albumArt: t.album?.images?.[t.album.images.length - 1]?.url ?? t.album?.images?.[0]?.url ?? "",
    duration_ms: t.duration_ms,
  }));

  return NextResponse.json({ tracks });
}
