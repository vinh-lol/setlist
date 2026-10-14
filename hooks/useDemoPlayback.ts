"use client";

// Demo mode (/party?demo): four made-up songs with their own covers and
// original placeholder lyrics, so you can design a look without Spotify or
// music playing. Plays, pauses and skips like the real thing. The third song
// has no lyrics on purpose, to show the big-player layout.

import { useEffect, useState } from "react";
import { seedLyrics, type LyricLine } from "@/lib/lyrics";
import type { SpotifyTrack } from "@/lib/types";
import type { PartyPlayback } from "./usePartyPlayback";

const track = (id: string, name: string, artist: string, album: string, seconds: number): SpotifyTrack => ({
  id: `demo-${id}`,
  playId: `demo-${id}`,
  name,
  artists: [artist],
  albumName: album,
  albumArt: `/demo/${id}.svg`,
  duration_ms: seconds * 1000,
});

export const DEMO_TRACKS: SpotifyTrack[] = [
  track("sunset", "Golden Hour Again", "The Placeholders", "Sample Sunsets", 48),
  track("tide", "Low Tide Lights", "Demo Coast", "Waves for Testing", 44),
  track("volt", "Static Charge", "Volt Club", "No Words Needed", 30),
  track("bloom", "Everything in Bloom", "Garden Party", "Petals", 44),
];

// Original placeholder lines, one every ~3.6s.
const DEMO_LYRICS: Record<string, string[]> = {
  "demo-sunset": [
    "Turn the music up a little louder",
    "Everybody's here and the night is young",
    "Lights are low and the colors keep on changing",
    "Sing it back like you know every word",
    "Golden hour again",
    "Golden hour again",
    "We don't need a reason, just a chorus",
    "Hold the moment, let it carry on",
    "Hands up when the beat comes back around",
    "Golden hour again",
    "One more song before the sun goes down",
  ],
  "demo-tide": [
    "Water on the window, music in the hall",
    "Every little light is a wave that we can follow",
    "Slow it down, then bring it back again",
    "Low tide lights",
    "Pulling us closer as the bass rolls in",
    "Low tide lights",
    "Nobody leaving till the last song ends",
    "Float a little longer",
    "Float a little longer",
    "Low tide lights, carry me home",
  ],
  "demo-bloom": [
    "Open up the windows, let the colors in",
    "Every song's a season, every room's a garden",
    "Everything in bloom",
    "Everything in bloom tonight",
    "Turn around and see who's dancing next to you",
    "Petals on the floor and nobody minds",
    "Everything in bloom",
    "Everything in bloom tonight",
    "Keep it growing, keep it going",
    "Everything in bloom",
  ],
};

for (const t of DEMO_TRACKS) {
  const lines = DEMO_LYRICS[t.id];
  const synced: LyricLine[] | null = lines ? lines.map((text, i) => ({ timeMs: 1200 + i * 3600, text })) : null;
  seedLyrics(t, { synced, plain: null });
}

export function useDemoPlayback(active: boolean): PartyPlayback {
  const [idx, setIdx] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now()); // wall time the song's position 0 maps to
  const [pausedAt, setPausedAt] = useState<number | null>(null); // position when paused
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [active]);

  const current = DEMO_TRACKS[idx];
  const positionMs = pausedAt ?? Math.max(0, now - startedAt);

  // Auto-advance at the end of each song, looping forever.
  useEffect(() => {
    if (active && pausedAt === null && positionMs >= current.duration_ms) {
      setIdx((i) => (i + 1) % DEMO_TRACKS.length);
      setStartedAt(Date.now());
    }
  }, [active, pausedAt, positionMs, current.duration_ms]);

  const go = (delta: number) => {
    setIdx((i) => (i + delta + DEMO_TRACKS.length) % DEMO_TRACKS.length);
    setStartedAt(Date.now());
    setPausedAt((p) => (p === null ? null : 0));
  };

  const upcoming = [1, 2, 3, 4, 5, 6].map((n) => {
    const t = DEMO_TRACKS[(idx + n) % DEMO_TRACKS.length];
    return { ...t, playId: `${t.playId}-${n}` };
  });

  return {
    current,
    upcoming,
    positionMs: Math.min(positionMs, current.duration_ms),
    pct: Math.min(100, (positionMs / current.duration_ms) * 100),
    playing: pausedAt === null,
    prev: () => go(-1),
    next: () => go(1),
    playPause: () => {
      if (pausedAt === null) setPausedAt(positionMs);
      else { setStartedAt(Date.now() - pausedAt); setPausedAt(null); }
    },
  };
}
