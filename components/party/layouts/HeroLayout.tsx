"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { MORPH } from "../morph";

// No-lyrics layout: one big player bubble (cover + now playing + transport)
// beside the title column.
export default function HeroLayout({
  glass,
  cover,
  nowPlaying,
  transport,
  side,
}: {
  glass: string;
  cover: ReactNode;
  nowPlaying: ReactNode;
  transport: ReactNode;
  side: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={MORPH}
      className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-8 lg:gap-12 px-8 lg:px-10 pt-9 pb-6"
    >
      {/* HERO — ONE bubble. A single lg-panel means a single backdrop-filter
          region, so there are NO internal seams: three separate panels each
          blur only their own clipped area, which left faint divider lines no
          matter how borders/shadows were tuned. Cover fills the left;
          now-playing (top) + timeline (bottom) stack on the right, inside the
          same bubble. */}
      <section className="min-h-0">
        <div className={`${glass} h-full w-full grid grid-cols-1 lg:grid-cols-2 grid-rows-[minmax(0,1fr)_auto_auto] lg:grid-rows-2`}>
          <div className="lg:row-span-2 flex items-center justify-center min-h-0 p-8">{cover}</div>
          <div className="min-w-0 flex flex-col justify-center min-h-0 px-8 xl:px-12 pt-8 xl:pt-10 lg:pb-3">{nowPlaying}</div>
          <div className="min-w-0 flex flex-col justify-center min-h-0 px-8 xl:px-12 pb-8 xl:pb-10 lg:pt-3">{transport}</div>
        </div>
      </section>

      {/* RIGHT — date/clock + editable title + info */}
      {side}
    </motion.div>
  );
}
