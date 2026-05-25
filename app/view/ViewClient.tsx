"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import Timeline from "@/components/Timeline";
import { buildTimeline, formatTime } from "@/lib/timeline";
import type { SpotifyTrack } from "@/lib/types";

interface Props {
  code: string;
  initialTracks: SpotifyTrack[];
  initialPlayedTracks: SpotifyTrack[];
  initialPartyStartMs: number;
  error?: boolean;
}

export default function ViewClient({
  code,
  initialTracks,
  initialPlayedTracks,
  initialPartyStartMs,
  error,
}: Props) {
  const [tracks, setTracks] = useState(initialTracks);
  const [playedTracks, setPlayedTracks] = useState(initialPlayedTracks);
  const [partyStartMs, setPartyStartMs] = useState(initialPartyStartMs);

  // Poll for live updates every 10s
  useEffect(() => {
    if (!code || error) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/setlists/${code}`);
        if (!res.ok) return;
        const data = await res.json();
        setTracks(data.tracks ?? []);
        setPlayedTracks(data.playedTracks ?? []);
        setPartyStartMs(data.partyStartMs);
      } catch {}
    };
    const id = setInterval(poll, 1_000);
    return () => clearInterval(id);
  }, [code, error]);

  const partyStart = useMemo(() => new Date(partyStartMs), [partyStartMs]);

  const playedMs = playedTracks.reduce((sum, t) => sum + t.duration_ms, 0);
  const setStart = useMemo(
    () => new Date(partyStart.getTime() - playedMs),
    [partyStart, playedMs]
  );
  const allTracks = [...playedTracks, ...tracks];
  const entries = useMemo(
    () => (allTracks.length > 0 ? buildTimeline(allTracks, setStart) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTracks.length, setStart]
  );

  if (error || (tracks.length === 0 && playedTracks.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-zinc-400 text-sm">Invalid or empty setlist link.</p>
        <Link href="/" className="text-[#1DB954] text-sm hover:underline">
          Create your own →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tighter">SETLIST</h1>
          <p className="text-zinc-500 text-xs mt-0.5">
            Party starts at <span className="text-zinc-300">{formatTime(partyStart)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[#1DB954] text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse" />
            live
          </span>
          <Link
            href="/"
            className="text-sm font-bold px-3 py-2 rounded-lg bg-[#1DB954] text-black hover:bg-[#1ed760] transition-colors"
          >
            Create your own
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex">
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 shrink-0 border-r border-zinc-800 overflow-y-auto flex flex-col">
            <div className="px-3 py-2 text-xs text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
              {allTracks.length} song{allTracks.length !== 1 ? "s" : ""}
            </div>

            {playedTracks.map((track, i) => (
              <div
                key={track.playId ?? "played-" + track.id + "-" + i}
                className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/30 opacity-35"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-400 text-xs font-medium truncate line-through">{track.name}</p>
                  <p className="text-zinc-600 text-[10px] truncate">{track.artists.join(", ")}</p>
                </div>
              </div>
            ))}

            {playedTracks.length > 0 && (
              <div className="px-3 py-1 text-[9px] text-zinc-600 uppercase tracking-widest bg-zinc-900/60 border-b border-zinc-800">
                now playing
              </div>
            )}

            {tracks.map((track, i) => (
              <div
                key={track.playId ?? track.id + "-" + i}
                className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white text-xs font-medium truncate">{track.name}</p>
                  <p className="text-zinc-500 text-[10px] truncate">{track.artists.join(", ")}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-hidden">
            <Timeline entries={entries} partyStart={setStart} accessToken="" />
          </div>
        </div>
      </main>
    </div>
  );
}
