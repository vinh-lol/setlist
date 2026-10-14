"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { MORPH } from "../morph";

const RADIUS = 26; // matches .lg-panel; set inline too so Framer can counter-scale it
const GAP = 20; // gap-5
const NP_H = 130; // now-playing panel height, roughly
const TP_H = 118; // controls panel height, roughly

// Lyrics layout: cover + now-playing + transport bubbles on the left, lyrics in
// the middle, the title column on the right. Each slot is passed in already
// rendered, so this file is only about arrangement. A null slot (widget turned
// off) drops its bubble; a null side column hands its width to the lyrics.
export default function ClassicLayout({
  glass,
  halo,
  cover,
  nowPlaying,
  transport,
  lyrics,
  side,
}: {
  glass: string;
  halo: string;
  cover: ReactNode;
  nowPlaying: ReactNode | null;
  transport: ReactNode | null;
  lyrics: ReactNode;
  side: ReactNode | null;
}) {
  // The cover panel is always square: as wide as the column, unless the column
  // is too short, in which case it shrinks to the height left after the
  // now-playing and controls panels below it (estimated, in px). 100cqh is the
  // column's height (container query units; where unsupported they fall back
  // to the viewport, which keeps the full-width square).
  const reserve = (nowPlaying ? NP_H + GAP : 0) + (transport ? TP_H + GAP : 0);
  const coverSize = `min(100%, calc(100cqh - ${reserve}px))`;
  const cols = side
    ? "lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,300px)]"
    : "lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]";
  return (
    <div className={`relative z-10 flex-1 min-h-0 grid grid-cols-1 ${cols} gap-8 lg:gap-12 px-8 lg:px-10 pt-9 pb-6`}>
      {/* LEFT — cover + now-playing bubble + timeline bubble. borderRadius
          is set inline (not just via the lg-panel class) so Framer can
          counter-scale it during the layout morph — otherwise the rounded
          corners distort/square off while the panels resize. */}
      <section className="hidden lg:flex flex-col min-h-0 gap-5 [container-type:size]">
        <motion.div layout layoutId="cover" transition={MORPH} className={`${glass} p-5 flex items-center justify-center shrink-0 aspect-square`} style={{ borderRadius: RADIUS, width: coverSize }}>{cover}</motion.div>
        {nowPlaying && <motion.div layout layoutId="np" transition={MORPH} className={`${glass} p-5`} style={{ borderRadius: RADIUS }}>{nowPlaying}</motion.div>}
        {transport && <motion.div layout layoutId="tp" transition={MORPH} className={`${glass} p-5`} style={{ borderRadius: RADIUS }}>{transport}</motion.div>}
      </section>

      {/* CENTER — lyrics over the gradient (halo for legibility) */}
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="h-full overflow-hidden min-h-[36vh] lg:min-h-0" style={{ textShadow: halo }}>
        {lyrics}
      </motion.section>

      {/* RIGHT — date/clock + editable title + info */}
      {side}
    </div>
  );
}
