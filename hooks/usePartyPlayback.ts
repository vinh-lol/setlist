"use client";

// Everything /party knows about playback: the current track, the live queue,
// a smooth position clock, lyric prefetch for what's next, and transport
// controls. Polls Spotify straight from the browser with the host's token.

import { useEffect, useMemo, useRef, useState } from "react";
import { getQueue, pausePlayback, resumePlayback, skipNext, skipPrevious } from "@/lib/spotify";
import { useCurrentlyPlaying } from "@/hooks/useCurrentlyPlaying";
import { prefetchLyrics } from "@/lib/lyrics";
import type { SpotifyTrack } from "@/lib/types";

export interface PartyPlayback {
  current: SpotifyTrack | null;
  upcoming: SpotifyTrack[];
  positionMs: number;
  /** Progress through the current track, 0..100. */
  pct: number;
  playing: boolean;
  prev: () => void;
  next: () => void;
  playPause: () => void;
}

const SNAP_MS = 1200; // farther off than this = a real jump (seek, skip)
const NUDGE = 0.25;   // share of a small error corrected per sample

export function usePartyPlayback(token: string): PartyPlayback {
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [positionMs, setPositionMs] = useState(0);
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);

  const nowPlaying = useCurrentlyPlaying(token);

  // Playback clock. Each poll's position is a little noisy (network and
  // Spotify's own sampling wobble by ~100-300ms), and snapping to every sample
  // made the lyrics jitter: a word could light, un-light, then light again.
  // So the clock runs on its own and each sample only nudges it a quarter of
  // the way. A big disagreement (seek, skip, pause/resume, new song) still
  // snaps straight to the new position.
  const clockRef = useRef<{ trackId: string; playing: boolean; offset: number; paused: number; sampleAt: number } | null>(null);
  if (nowPlaying && clockRef.current?.sampleAt !== nowPlaying.fetchedAt) {
    const c = clockRef.current;
    const sample = nowPlaying.progressMs;
    const at = nowPlaying.fetchedAt;
    const predicted = c ? (c.playing ? at + c.offset : c.paused) : NaN;
    const err = sample - predicted;
    const snap = !c || c.trackId !== nowPlaying.trackId || c.playing !== nowPlaying.isPlaying || !(Math.abs(err) < SNAP_MS);
    const pos = snap ? sample : predicted + err * NUDGE;
    clockRef.current = { trackId: nowPlaying.trackId, playing: nowPlaying.isPlaying, offset: pos - at, paused: pos, sampleAt: at };
  }

  // Live Spotify queue
  useEffect(() => {
    if (!token) return;
    let active = true;
    const poll = async () => {
      try { const q = await getQueue(token); if (active) setQueue(q); } catch {}
    };
    poll();
    const id = setInterval(poll, 3_000);
    return () => { active = false; clearInterval(id); };
  }, [token]);

  // Smooth playback clock
  useEffect(() => {
    const tick = () => {
      const c = clockRef.current;
      if (c) setPositionMs(c.playing ? Date.now() + c.offset : c.paused);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, []);

  // Current track comes straight from currently-playing (follows any device, no
  // queue lag); the queue only feeds "up next".
  const qIdx = nowPlaying?.trackId ? queue.findIndex((t) => t.id === nowPlaying.trackId) : -1;
  const current: SpotifyTrack | null = nowPlaying?.track ?? queue[Math.max(0, qIdx)] ?? null;
  // Same array until the queue actually changes, so memoized pieces (up next) skip re-rendering.
  const upcomingKey = queue.map((t) => t.playId ?? t.id).join(",") + `|${qIdx}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const upcoming = useMemo(() => queue.slice((qIdx >= 0 ? qIdx : 0) + 1), [upcomingKey]);

  // Prefetch lyrics for the next couple of tracks so there's no fetch pause when
  // the song changes — by then the result is already cached (instant, no flash).
  const prefetchKey = upcoming.slice(0, 2).map((t) => t.id).join(",");
  useEffect(() => {
    upcoming.slice(0, 2).forEach(prefetchLyrics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchKey]);

  const pct = current ? Math.min(100, (positionMs / current.duration_ms) * 100) : 0;

  // Transport controls (host token); optimistic play/pause flips the icon instantly.
  const playing = optimisticPlaying ?? (nowPlaying?.isPlaying ?? false);
  const prev = () => { if (token) skipPrevious(token).catch(() => {}); };
  const next = () => { if (token) skipNext(token).catch(() => {}); };
  const playPause = () => {
    if (!token) return;
    const want = !playing;
    setOptimisticPlaying(want);
    (want ? resumePlayback(token) : pausePlayback(token)).catch(() => {});
    setTimeout(() => setOptimisticPlaying(null), 2500);
  };

  return { current, upcoming, positionMs, pct, playing, prev, next, playPause };
}
