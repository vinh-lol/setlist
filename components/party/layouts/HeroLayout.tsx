"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { MORPH } from "../morph";

// No-lyrics layout: one big player bubble (cover + now playing + transport)
// beside the title column. Null slots (widgets turned off) collapse their row,
// column or the whole side column.
export default function HeroLayout({
  glass,
  cover,
  nowPlaying,
  transport,
  side,
}: {
  glass: string;
  cover: ReactNode;
  nowPlaying: ReactNode | null;
  transport: ReactNode | null;
  side: ReactNode | null;
}) {
  const info = [nowPlaying, transport].filter(Boolean).length; // 0, 1 or 2 rows beside the cover
  const cols = side ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]" : "";
  const bubbleCols = info ? "lg:grid-cols-2" : "";
  const bubbleRows = info === 2 ? "grid-rows-[minmax(0,1fr)_auto_auto] lg:grid-rows-2" : "grid-rows-[minmax(0,1fr)_auto] lg:grid-rows-1";
  const coverSpan = info === 2 ? "lg:row-span-2" : "";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={MORPH}
      className={`relative z-10 flex-1 min-h-0 grid grid-cols-1 ${cols} gap-8 lg:gap-12 px-8 lg:px-10 pt-9 pb-6`}
    >
      {/* HERO — ONE bubble. A single lg-panel means a single backdrop-filter
          region, so there are NO internal seams: three separate panels each
          blur only their own clipped area, which left faint divider lines no
          matter how borders/shadows were tuned. Cover fills the left;
          now-playing (top) + timeline (bottom) stack on the right, inside the
          same bubble. */}
      <section className="min-h-0 flex justify-center [container-type:size]">
        {/* With only the cover left, the bubble is a square that hugs it. */}
        <div
          className={`${glass} grid grid-cols-1 ${bubbleCols} ${bubbleRows} ${info ? "h-full w-full" : "aspect-square"}`}
          style={info ? undefined : { width: "min(100%, 100cqh)" }}
        >
          <div className={`${coverSpan} min-h-0 min-w-0 p-8`}>{cover}</div>
          {nowPlaying && <div className={`min-w-0 flex flex-col justify-center min-h-0 px-8 xl:px-12 pt-8 xl:pt-10 ${transport ? "lg:pb-3" : "pb-8 xl:pb-10"}`}>{nowPlaying}</div>}
          {transport && <div className={`min-w-0 flex flex-col justify-center min-h-0 px-8 xl:px-12 pb-8 xl:pb-10 ${nowPlaying ? "lg:pt-3" : "pt-8 xl:pt-10"}`}>{transport}</div>}
        </div>
      </section>

      {/* RIGHT — date/clock + editable title + info */}
      {side}
    </motion.div>
  );
}
