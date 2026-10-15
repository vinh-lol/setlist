import type { SpotifyTrack } from "@/lib/types";

export interface LyricWord {
  text: string;
  timeMs: number;
}

export interface LyricLine {
  timeMs: number;
  text: string;
  /** Word start times, when the source has them (enhanced LRC). */
  words?: LyricWord[];
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

// Put known lyrics straight into the cache (used by demo mode's sample tracks,
// which have no real lyrics to fetch).
export function seedLyrics(track: SpotifyTrack, result: LyricsResult): void {
  resolved.set(lyricsKey(track), result);
}

// Warm the cache for an upcoming track (fire-and-forget).
export function prefetchLyrics(track: SpotifyTrack | null | undefined): void {
  if (track) void fetchLyrics(track);
}

// Matches LRC timestamps like [01:23.45] or [01:23] (also tolerates [mm:ss:xx])
const TIMESTAMP = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
// Enhanced LRC word tags: <01:23.45>word <01:24.10>word
const WORD_TAG = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>/g;

const toMs = (m: RegExpMatchArray) =>
  (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 1000 + (m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) : 0);

/** Pulls word start times out of an enhanced-LRC line body, if it has any. */
function parseWords(body: string): { text: string; words?: LyricWord[] } {
  const tags = [...body.matchAll(WORD_TAG)];
  const text = body.replace(WORD_TAG, "").replace(/\s+/g, " ").trim();
  if (tags.length === 0) return { text };
  const words: LyricWord[] = [];
  tags.forEach((m, i) => {
    const from = (m.index ?? 0) + m[0].length;
    const to = i + 1 < tags.length ? tags[i + 1].index ?? body.length : body.length;
    const chunk = body.slice(from, to).trim();
    // a chunk may hold several words; they share the tag's time
    for (const w of chunk.split(/\s+/).filter(Boolean)) words.push({ text: w, timeMs: toMs(m) });
  });
  return { text, words: words.length ? words : undefined };
}

// Parses an LRC string into time-sorted lines. A single line may carry several
// timestamps (repeated lyrics) — each becomes its own entry. Enhanced LRC word
// tags are kept as per-word times.
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split("\n")) {
    const matches = [...raw.matchAll(TIMESTAMP)];
    if (matches.length === 0) continue;
    const { text, words } = parseWords(raw.replace(TIMESTAMP, ""));
    for (const m of matches) {
      const timeMs = toMs(m);
      // repeated lines: shift the word times along with the line
      const shift = words ? timeMs - toMs(matches[0]) : 0;
      lines.push({ timeMs, text, words: words?.map((w) => ({ ...w, timeMs: w.timeMs + shift })) });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}
