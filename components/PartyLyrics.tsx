"use client";

import { useEffect, useRef, useState } from "react";
import type { LyricLine } from "@/lib/lyrics";

interface Props {
  lines: LyricLine[] | null;
  activeIdx: number;
  positionMs: number;
  plain: string | null;
  loading: boolean;
  accent: string; // album accent for revealed words
  faint: string;  // ink-derived low-alpha for pending words (legible on dark themes)
}

const FADE_MASK = "linear-gradient(to bottom, transparent, black 4%, black 90%, transparent)";
const ANCHOR_FRAC = 0.06; // current line sits at the top, aligned with the cover/title
const MAX_WORD_MS = 700;  // cap per-word reveal so a held note / instrumental gap can't crawl
const LAST_WORD_MS = 380; // steady fallback pace for the final line (no next line to time against)

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center opacity-40 text-sm tracking-[0.2em] uppercase" style={{ fontFamily: "var(--font-sans)" }}>
      {children}
    </div>
  );
}

// Two-line sliding window. Current + next show at the SAME large size; the current
// line reveals word-by-word (faint → accent). When a line finishes, the stack
// slides up: the just-played line fades out the top while the next slides into the
// current slot and a new next fades in below.
export default function PartyLyrics({ lines, activeIdx, positionMs, plain, loading, accent, faint }: Props) {
  const vpRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [ty, setTy] = useState(0);
  // How many lines past the current one to reveal — measured so the (fixed-size)
  // lyrics box is filled regardless of how short the lines are. Always ≥ 1 so
  // there's a "next" line even when lines are tall.
  const [maxRel, setMaxRel] = useState(1);

  const idx = activeIdx < 0 ? 0 : activeIdx;

  useEffect(() => {
    const measure = () => {
      const vp = vpRef.current;
      const el = lineRefs.current[idx];
      if (!vp || !el || !lines) return;
      const anchorTop = vp.clientHeight * ANCHOR_FRAC;
      setTy(anchorTop - el.offsetTop);
      // Include each following line whose top still lands inside the viewport
      // (the bottom fade mask softens the last, partially-shown one).
      let last = 1;
      for (let i = idx + 1; i < lines.length; i++) {
        const e = lineRefs.current[i];
        if (!e) break;
        if (anchorTop + (e.offsetTop - el.offsetTop) < vp.clientHeight) last = i - idx;
        else break;
      }
      setMaxRel(last);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [idx, lines]);

  if (loading) return <Empty>loading lyrics</Empty>;

  if (lines && lines.length > 0) {
    const started = activeIdx >= 0;
    const cur = lines[idx];
    const nxt = lines[idx + 1] ?? null;
    const curWords = (cur?.text || "♪").split(/\s+/).filter(Boolean);
    const gap = nxt ? nxt.timeMs - cur.timeMs : Infinity;
    // Spread the reveal across the line's real on-screen window (the gap to the
    // next line) instead of a fixed per-word pace, so the fill tracks how long the
    // line is actually sung. Cap it so a long held note / instrumental tail can't
    // make the reveal crawl; use a steady pace on the final line (no next line).
    const revealDur = Number.isFinite(gap)
      ? Math.min(gap, curWords.length * MAX_WORD_MS)
      : curWords.length * LAST_WORD_MS;
    const frac = !started ? -1 : Math.min(1, Math.max(0, (positionMs - cur.timeMs) / revealDur));
    // Reveal weighted by word length (a rough syllable/duration proxy) rather than
    // equal slices, so longer words hold the line longer — closer to real singing.
    const wlens = curWords.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length || w.length));
    const totalW = wlens.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    let curRevealed = 0;
    for (let i = 0; i < curWords.length; i++) {
      if (frac >= acc / totalW) curRevealed = i + 1; else break;
      acc += wlens[i];
    }

    return (
      <div ref={vpRef} className="relative h-full overflow-hidden" style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}>
        <div
          className="absolute inset-x-0 top-0 will-change-transform transition-transform duration-[420ms] ease-out motion-reduce:transition-none"
          style={{ transform: `translateY(${ty}px)` }}
        >
          {lines.map((l, i) => {
            const rel = i - idx;
            const visible = rel >= 0 && rel <= maxRel; // current + as many as fit
            const words = (l.text || "♪").split(/\s+/).filter(Boolean);
            const revealed = rel === 0 ? curRevealed : 0;
            return (
              <div
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                className="px-6 py-2.5 transition-opacity duration-[420ms] ease-out motion-reduce:transition-none"
                style={{ opacity: visible ? 1 : 0 }}
              >
                <p className="uppercase leading-[0.95] tracking-tight text-[clamp(2.25rem,4.6vw,4.5rem)]" style={{ fontFamily: "var(--font-lyric)" }}>
                  {words.map((w, wi) => (
                    <span
                      key={wi}
                      className="inline-block mr-[0.28em] motion-reduce:transition-none"
                      style={{ color: wi < revealed ? accent : faint, transition: "color 300ms ease-out" }}
                    >
                      {w}
                    </span>
                  ))}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (plain) {
    return (
      <div className="h-full overflow-hidden flex items-center opacity-75">
        <p className="uppercase text-3xl xl:text-5xl leading-snug tracking-tight whitespace-pre-line" style={{ fontFamily: "var(--font-lyric)", overflowWrap: "anywhere" }}>
          {plain}
        </p>
      </div>
    );
  }

  return <Empty>no lyrics for this one</Empty>;
}
