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

export function usePartyPlayback(token: string): PartyPlayback {
  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [positionMs, setPositionMs] = useState(0);
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);

  const nowPlaying = useCurrentlyPlaying(token);
  const anchorRef = useRef<{ at: number; progress: number; playing: boolean } | null>(null);
  if (nowPlaying) anchorRef.current = { at: nowPlaying.fetchedAt, progress: nowPlaying.progressMs, playing: nowPlaying.isPlaying };

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
      const a = anchorRef.current;
      if (a) setPositionMs(a.playing ? a.progress + (Date.now() - a.at) : a.progress);
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
