"use client";

import Image from "next/image";
import type { TimelineEntry } from "@/lib/types";
import { formatTime, formatDuration } from "@/lib/timeline";

interface Props {
  entry: TimelineEntry;
  state: "past" | "current" | "upcoming";
}

export default function SongBlock({ entry, state }: Props) {
  const { track, startTime, heightPx } = entry;

  const stateClasses = {
    past: "opacity-50 saturate-50",
    current: "z-10",
    upcoming: "hover:brightness-110",
  }[state];

  return (
    <div
      className={`relative flex overflow-hidden transition-all duration-500 ${stateClasses}`}
      style={{
        height: heightPx,
        borderLeft: state === "current" ? "4px solid #1DB954" : "4px solid transparent",
        boxShadow: state === "current" ? "0 0 20px 2px rgba(29,185,84,0.25)" : undefined,
      }}
    >
      {/* Blurred album art as background */}
      {track.albumArt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.albumArt}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "blur(18px) brightness(0.32) saturate(1.6)", transform: "scale(1.15)" }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between py-3 pr-3 pl-6 w-full min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-white leading-tight truncate text-base drop-shadow">
              {track.name}
            </p>
            <p className="text-zinc-300 text-sm truncate mt-0.5 drop-shadow">
              {track.artists.join(", ")}
            </p>
          </div>
          {/* Album art thumbnail — only show if block is tall enough */}
          {heightPx >= 80 && track.albumArt && (
            <div className="relative shrink-0 w-14 h-14 rounded-md overflow-hidden shadow-lg">
              <Image
                src={track.albumArt}
                alt={track.albumName}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
          )}
        </div>

        {/* Bottom row: start time + duration */}
        {heightPx >= 60 && (
          <div className="flex items-end justify-between">
            <span className="text-zinc-400 text-[10px] font-mono drop-shadow">
              {formatTime(startTime)}
            </span>
            <span className="text-zinc-400 text-[10px] font-mono drop-shadow">
              {formatDuration(track.duration_ms)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
