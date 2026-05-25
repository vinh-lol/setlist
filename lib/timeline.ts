import type { SpotifyTrack, TimelineEntry } from "./types";

export const MS_PER_PX = 1000; // 1px = 1 second
export const MIN_BLOCK_PX = 48; // minimum height so short songs are readable

export function buildTimeline(
  tracks: SpotifyTrack[],
  partyStart: Date
): TimelineEntry[] {
  let cumulativeMs = 0;
  return tracks.map((track) => {
    const startMs = cumulativeMs;
    const startTime = new Date(partyStart.getTime() + startMs);
    const heightPx = Math.max(track.duration_ms / MS_PER_PX, MIN_BLOCK_PX);
    const offsetPx = startMs / MS_PER_PX;
    cumulativeMs += track.duration_ms;
    return { track, startTime, startMs, heightPx, offsetPx };
  });
}

export function getNowOffsetPx(partyStart: Date): number {
  return (Date.now() - partyStart.getTime()) / MS_PER_PX;
}

export function getCurrentIndex(entries: TimelineEntry[], partyStart: Date): number {
  const elapsedMs = Date.now() - partyStart.getTime();
  let idx = -1;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].startMs <= elapsedMs) idx = i;
    else break;
  }
  return idx;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
