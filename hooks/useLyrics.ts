"use client";

import { useEffect, useState } from "react";
import { parseLrc, type LyricLine } from "@/lib/lyrics";
import type { SpotifyTrack } from "@/lib/types";

export interface LyricsData {
  synced: LyricLine[] | null;
  plain: string | null;
  loading: boolean;
}

const EMPTY: LyricsData = { synced: null, plain: null, loading: false };

// Fetches lyrics for the given track from our /api/lyrics proxy and parses any
// synced LRC into timestamped lines. Re-fetches whenever the track changes.
export function useLyrics(track: SpotifyTrack | null): LyricsData {
  const [data, setData] = useState<LyricsData>(EMPTY);

  const key = track ? `${track.name}|${track.artists[0] ?? ""}` : "";

  useEffect(() => {
    if (!track) {
      setData(EMPTY);
      return;
    }
    let active = true;
    setData((d) => ({ ...d, loading: true }));

    const params = new URLSearchParams({
      track: track.name,
      artist: track.artists[0] ?? "",
      album: track.albumName ?? "",
      duration: String(Math.round(track.duration_ms / 1000)),
    });

    fetch(`/api/lyrics?${params}`)
      .then((r) => r.json())
      .then((j: { synced: string | null; plain: string | null }) => {
        if (!active) return;
        setData({
          synced: j.synced ? parseLrc(j.synced) : null,
          plain: j.plain ?? null,
          loading: false,
        });
      })
      .catch(() => {
        if (active) setData(EMPTY);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return data;
}
