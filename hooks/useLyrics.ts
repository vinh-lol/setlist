"use client";

import { useEffect, useState } from "react";
import { fetchLyrics, getCachedLyrics, lyricsKey } from "@/lib/lyrics";
import type { LyricLine } from "@/lib/lyrics";
import type { SpotifyTrack } from "@/lib/types";

export interface LyricsData {
  synced: LyricLine[] | null;
  plain: string | null;
  loading: boolean;
}

const EMPTY: LyricsData = { synced: null, plain: null, loading: false };

// Returns lyrics for the given track. Reads the shared cache synchronously when
// the track was prefetched (no loading flash / layout flicker); otherwise
// fetches and flips loading. Prefetching upcoming tracks happens in /party.
export function useLyrics(track: SpotifyTrack | null): LyricsData {
  const key = track ? lyricsKey(track) : "";
  const [data, setData] = useState<LyricsData>(() => {
    const cached = track ? getCachedLyrics(track) : null;
    return cached ? { ...cached, loading: false } : EMPTY;
  });

  useEffect(() => {
    if (!track) {
      setData(EMPTY);
      return;
    }
    const cached = getCachedLyrics(track);
    if (cached) {
      setData({ ...cached, loading: false });
      return;
    }
    let active = true;
    setData((d) => ({ ...d, loading: true }));
    fetchLyrics(track).then((res) => {
      if (active) setData({ ...res, loading: false });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return data;
}
