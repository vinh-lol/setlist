"use client";

import { useEffect, useState } from "react";
import { getCurrentlyPlaying } from "@/lib/spotify";

interface NowPlaying {
  trackId: string;
  progressMs: number;
  isPlaying: boolean;
}

export function useCurrentlyPlaying(accessToken: string): NowPlaying | null {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;

    const poll = async () => {
      try {
        const result = await getCurrentlyPlaying(accessToken);
        if (mounted) setNowPlaying(result);
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
