import { decodeSetlist } from "@/lib/share";
import type { SpotifyTrack } from "@/lib/types";
import ViewClient from "./ViewClient";

async function fetchFullTracks(ids: string[]): Promise<Map<string, { albumArt: string; albumName: string }>> {
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const { access_token } = await tokenRes.json();

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  const pages = await Promise.all(
    chunks.map(chunk =>
      fetch(`https://api.spotify.com/v1/tracks?ids=${chunk.join(",")}`, {
        headers: { Authorization: `Bearer ${access_token}` },
        next: { revalidate: 3600 },
      }).then(r => r.json())
    )
  );

  const map = new Map<string, { albumArt: string; albumName: string }>();
  for (const page of pages) {
    for (const t of page.tracks ?? []) {
      if (!t) continue;
      map.set(t.id, {
        albumArt: t.album?.images?.[0]?.url ?? "",
        albumName: t.album?.name ?? "",
      });
    }
  }
  return map;
}

export default async function ViewPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;

  if (!s) {
    return <ViewClient tracks={[]} partyStartMs={Date.now()} error />;
  }

  const decoded = decodeSetlist(s);
  if (!decoded) {
    return <ViewClient tracks={[]} partyStartMs={Date.now()} error />;
  }

  let tracks: SpotifyTrack[] = decoded.tracks;

  try {
    const map = await fetchFullTracks(decoded.tracks.map(t => t.id));
    tracks = decoded.tracks.map(t => ({
      ...t,
      ...(map.get(t.id) ?? {}),
    }));
  } catch (e) {
    console.error("[view] Failed to fetch track art from Spotify:", e);
    // use decoded tracks as-is (no album art)
  }

  return <ViewClient tracks={tracks} partyStartMs={decoded.partyStart.getTime()} />;
}
