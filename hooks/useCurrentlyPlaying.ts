"use client";

import { useEffect, useState } from "react";
import { getCurrentlyPlaying } from "@/lib/spotify";
import type { SpotifyTrack } from "@/lib/types";

interface NowPlaying {
  trackId: string;
  progressMs: number;
  isPlaying: boolean;
  fetchedAt: number; // Date.now() when the response resolved (latency-compensated anchor)
  track: SpotifyTrack | null;
}

export function useCurrentlyPlaying(accessToken: string): NowPlaying | null {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;

    const poll = async () => {
      try {
        const start = Date.now();
        const result = await getCurrentlyPlaying(accessToken);
        const end = Date.now();
        if (!mounted) return;
        if (!result) { setNowPlaying(null); return; }
        // Spotify sampled progress mid-flight; add ~half the round-trip back so the
        // anchored position reflects "now", not when the request left.
        const comp = result.isPlaying ? Math.min(1500, Math.round((end - start) / 2)) : 0;
        setNowPlaying({ ...result, progressMs: result.progressMs + comp, fetchedAt: end });
      } catch {
        // silently ignore polling errors
      }
    };

    poll();
    const id = setInterval(poll, 2_000);
    return () => { mounted = false; clearInterval(id); };
  }, [accessToken]);

  return nowPlaying;
}
