import type { SpotifyTrack } from "@/lib/types";

export interface LyricLine {
  timeMs: number;
  text: string;
}

export interface LyricsResult {
  synced: LyricLine[] | null;
  plain: string | null;
}

// Client-side lyrics cache. Lets us prefetch upcoming tracks so there's no fetch
// pause when the song changes, and lets useLyrics read a warmed result
// synchronously (no loading flash / layout flicker).
const resolved = new Map<string, LyricsResult>();
const inflight = new Map<string, Promise<LyricsResult>>();

export function lyricsKey(track: SpotifyTrack): string {
  return `${track.name}|${track.artists[0] ?? ""}`;
}

export function getCachedLyrics(track: SpotifyTrack): LyricsResult | null {
  return resolved.get(lyricsKey(track)) ?? null;
}

// Fetch (or return the cached/in-flight) lyrics for a track. Idempotent per key.
export function fetchLyrics(track: SpotifyTrack): Promise<LyricsResult> {
  const k = lyricsKey(track);
  const done = resolved.get(k);
  if (done) return Promise.resolve(done);
  const pending = inflight.get(k);
  if (pending) return pending;

  const params = new URLSearchParams({
    track: track.name,
    artist: track.artists[0] ?? "",
    album: track.albumName ?? "",
    duration: String(Math.round(track.duration_ms / 1000)),
  });
  const p = fetch(`/api/lyrics?${params}`)
    .then((r) => r.json())
    .then((j: { synced: string | null; plain: string | null }) => {
      const res: LyricsResult = { synced: j.synced ? parseLrc(j.synced) : null, plain: j.plain ?? null };
      resolved.set(k, res);
      inflight.delete(k);
      return res;
    })
    .catch(() => {
      inflight.delete(k); // allow a later retry
      return { synced: null, plain: null } as LyricsResult;
    });
  inflight.set(k, p);
  return p;
}

// Warm the cache for an upcoming track (fire-and-forget).
export function prefetchLyrics(track: SpotifyTrack | null | undefined): void {
  if (track) void fetchLyrics(track);
}

// Matches LRC timestamps like [01:23.45] or [01:23] (also tolerates [mm:ss:xx])
const TIMESTAMP = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

// Parses an LRC string into time-sorted lines. A single line may carry several
// timestamps (repeated lyrics) — each becomes its own entry.
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split("\n")) {
    const matches = [...raw.matchAll(TIMESTAMP)];
    if (matches.length === 0) continue;
    const text = raw.replace(TIMESTAMP, "").trim();
    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      lines.push({ timeMs: (min * 60 + sec) * 1000 + frac, text });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}
