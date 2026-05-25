"use client";

import { useEffect, useRef, createRef, useState } from "react";
import type { TimelineEntry } from "@/lib/types";
import { getCurrentIndex, formatTime, getNowOffsetPx } from "@/lib/timeline";
import { useCurrentlyPlaying } from "@/hooks/useCurrentlyPlaying";
import { pausePlayback, resumePlayback, skipNext, skipPrevious } from "@/lib/spotify";
import SongBlock from "./SongBlock";
import NowIndicator from "./NowIndicator";

interface Props {
  entries: TimelineEntry[];
  partyStart: Date;
  accessToken: string;
  playedCount?: number;
  onReorder?: (fromTrackIdx: number, toTrackIdx: number) => void;
  queuedIds?: string[];
}

export default function Timeline({ entries, partyStart, accessToken, playedCount = 0, onReorder, queuedIds = [] }: Props) {
  const songRefs = useRef(entries.map(() => createRef<HTMLDivElement | null>()));
  const nowPlaying = useCurrentlyPlaying(accessToken);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [nowPx, setNowPx] = useState<number | null>(null);
  // Optimistic playback state — flips immediately on button press, corrected on next poll
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);
  const optimisticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stores the most recent Spotify-reported position so we can extrapolate between polls
  const anchorRef = useRef<{ syncedAt: number; basePx: number } | null>(null);
  // Ref-mirror of nowPlaying so the 100ms tick can read isPlaying without restarting the interval
  const nowPlayingRef = useRef(nowPlaying);
  nowPlayingRef.current = nowPlaying;

  const clockIndex = getCurrentIndex(entries, partyStart);
  const spotifyIndex = nowPlaying
    ? entries.findIndex((e, i) => i >= playedCount && e.track.id === nowPlaying.trackId)
    : -1;
  const currentIndex = spotifyIndex !== -1 ? spotifyIndex : clockIndex;

  // Update anchor synchronously during render (not in useEffect) so the 100ms tick
  // never sees stale anchorRef data between a nowPlaying state change and the effect firing.
  // Without this, on song transitions the tick reads the old anchor + ~2s elapsed = bar jump.
  const prevAnchorInputRef = useRef<{ nowPlaying: typeof nowPlaying; currentIndex: number } | null>(null);
  if (
    nowPlaying &&
    currentIndex >= 0 &&
    entries[currentIndex] &&
    (prevAnchorInputRef.current?.nowPlaying !== nowPlaying ||
      prevAnchorInputRef.current?.currentIndex !== currentIndex)
  ) {
    prevAnchorInputRef.current = { nowPlaying, currentIndex };
    anchorRef.current = {
      syncedAt: Date.now(),
      basePx: entries[currentIndex].offsetPx + nowPlaying.progressMs / 1000,
    };
  }

  // Tick every 100ms: advance from Spotify anchor when available, fall back to partyStart clock.
  // When paused, elapsed stays 0 so the bar is frozen at the exact paused position.
  useEffect(() => {
    const tick = () => {
      if (anchorRef.current) {
        const isPlaying = nowPlayingRef.current?.isPlaying === true;
        const elapsed = isPlaying ? (Date.now() - anchorRef.current.syncedAt) / 1000 : 0;
        setNowPx(anchorRef.current.basePx + elapsed);
      } else {
        setNowPx(getNowOffsetPx(partyStart));
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [partyStart]);

  useEffect(() => {
    return () => { if (optimisticTimerRef.current) clearTimeout(optimisticTimerRef.current); };
  }, []);

  useEffect(() => {
    songRefs.current = entries.map((_, i) => songRefs.current[i] ?? createRef());
  }, [entries]);

  useEffect(() => {
    if (currentIndex < 0) return;
    const el = songRefs.current[currentIndex]?.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentIndex]);

  useEffect(() => {
    if (currentIndex < 0) return;
    const el = songRefs.current[currentIndex]?.current;
    el?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived: what's actually playing right now (optimistic overrides until next poll corrects it)
  const isPlaying = optimisticPlaying !== null ? optimisticPlaying : (nowPlaying?.isPlaying ?? false);

  const setOptimistic = (playing: boolean) => {
    if (optimisticTimerRef.current) clearTimeout(optimisticTimerRef.current);
    setOptimisticPlaying(playing);
    // Clear optimistic override after 3s so the next Spotify poll takes over
    optimisticTimerRef.current = setTimeout(() => setOptimisticPlaying(null), 3000);
  };

  const handlePlayPause = async () => {
    setOptimistic(!isPlaying);
    try {
      if (isPlaying) await pausePlayback(accessToken);
      else await resumePlayback(accessToken);
    } catch { setOptimisticPlaying(null); }
  };

  const handleSkipNext = async () => {
    try { await skipNext(accessToken); } catch { /* ignore */ }
  };

  const handleSkipPrev = async () => {
    try { await skipPrevious(accessToken); } catch { /* ignore */ }
  };

  const totalPx = entries.reduce((sum, e) => sum + e.heightPx, 0);

  return (
    <div className="h-full overflow-y-auto relative">
      <div className="flex" style={{ minHeight: totalPx }}>
        {/* Time column — z-[30] so timestamps render above the now-bar line */}
        <div className="w-[72px] shrink-0 relative z-[30]">
          {entries.map((entry, i) => (
            <div
              key={entry.track.playId ?? entry.track.id + i}
              className="absolute right-2 text-[10px] text-zinc-500 font-mono leading-none"
              style={{ top: entry.offsetPx + 4 }}
            >
              {formatTime(entry.startTime)}
            </div>
          ))}

          {/* Playback controls — float in the time column just above the LIVE bar */}
          {nowPx !== null && (
            <div
              className="absolute left-0 right-0 flex items-center justify-center gap-[3px] pointer-events-auto"
              style={{ top: nowPx - 36, zIndex: 40 }}
            >
              {/* Skip previous */}
              <button
                onClick={handleSkipPrev}
                title="Previous"
                className="w-[18px] h-[18px] flex items-center justify-center rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V13.3a.7.7 0 0 1-.7.7H2.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h.6z"/>
                </svg>
              </button>

              {/* Play / Pause */}
              <button
                onClick={handlePlayPause}
                title={isPlaying ? "Pause" : "Play"}
                className="w-[22px] h-[22px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                {isPlaying ? (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                    <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/>
                  </svg>
                )}
              </button>

              {/* Skip next */}
              <button
                onClick={handleSkipNext}
                title="Next"
                className="w-[18px] h-[18px] flex items-center justify-center rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V13.3a.7.7 0 0 0 .7.7h.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-.6z"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Song blocks column */}
        <div className="flex-1 relative">
          {nowPx !== null && <NowIndicator offsetPx={nowPx} />}

          {entries.map((entry, i) => {
            const trackIdx = i - playedCount;
            const isDraggable = !!onReorder && trackIdx > 0;
            const isDragging = dragIdx === i;
            const isValidDrop = dragIdx !== null && isDraggable && dragIdx !== i;
            const isOver = overIdx === i && isValidDrop;
            const state =
              i < currentIndex ? "past" : i === currentIndex ? "current" : "upcoming";

            const isQueued = queuedIds.includes(entry.track.playId);
            const animDelay = isQueued ? 0 : Math.min((i - playedCount) * 30, 400);

            return (
              <div
                key={entry.track.playId ?? entry.track.id + i}
                ref={songRefs.current[i]}
                draggable={isDraggable}
                onDragStart={isDraggable ? (e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDragIdx(i);
                } : undefined}
                onDragOver={(e) => {
                  if (!isValidDrop) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverIdx(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null && onReorder && dragIdx !== i) {
                    const from = dragIdx - playedCount;
                    const to = i - playedCount;
                    if (from > 0 && to > 0) onReorder(from, to);
                  }
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`slide-in-right${isDragging ? " !opacity-35" : ""}`}
                style={{
                  opacity: 0,
                  animationDelay: `${animDelay}ms`,
                  animationFillMode: "forwards",
                  cursor: isDraggable ? (isDragging ? "grabbing" : "grab") : undefined,
                  outline: isOver ? "2px solid #1DB954" : "2px solid transparent",
                  outlineOffset: "-2px",
                  position: "relative",
                  zIndex: isDragging ? 0 : undefined,
                }}
              >
                <SongBlock entry={entry} state={state} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
