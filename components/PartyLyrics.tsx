"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { LyricLine } from "@/lib/lyrics";
import { splitWords, wordFills, wordTimes } from "@/lib/lyricTiming";

interface Props {
  lines: LyricLine[] | null;
  activeIdx: number;
  positionMs: number;
  plain: string | null;
  loading: boolean;
  accent: string; // album accent for revealed words
  faint: string;  // ink-derived low-alpha for pending words (legible on dark themes)
  /** word = build word by word; sweep = smooth karaoke fill; line = whole line lights at once */
  reveal?: "word" | "sweep" | "line";
  scale?: number; // lyric size multiplier (1 = original size)
  fontKey?: string; // changes when the lyric font changes, to re-measure line heights
  /** scroll = current line plus the lines coming up; focus = one big line at a time */
  layout?: "scroll" | "focus";
  caps?: boolean;
  align?: "left" | "center";
  effect?: "none" | "glow" | "outline" | "pop";
}

const FADE_MASK = "linear-gradient(to bottom, transparent, black 4%, black 90%, transparent)";
const ANCHOR_FRAC = 0.06; // current line sits at the top, aligned with the cover/title
const BASE_SIZE = "clamp(2.25rem, 4.6vw, 4.5rem)";

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center opacity-40 text-sm tracking-[0.2em] uppercase" style={{ fontFamily: "var(--font-sans)" }}>
      {children}
    </div>
  );
}

/** One word, styled for its fill amount and the chosen effect. */
function Word({ text, fill, current, active, accent, faint, reveal, effect }: {
  text: string; fill: number; current: boolean; active: boolean; accent: string; faint: string; reveal: Props["reveal"]; effect: Props["effect"];
}) {
  const outline = effect === "outline";
  const lit = fill > 0;
  // Every word of the current line uses the gradient in karaoke mode (even
  // unfilled or full ones), so nothing swaps paint mid-line.
  const sweeping = reveal === "sweep" && current;
  const paint: CSSProperties = sweeping
    ? {
        // A hard edge slides across the word; the transition smooths the
        // 100ms position ticks into a continuous sweep.
        backgroundImage: `linear-gradient(90deg, ${accent} 50%, ${outline ? "transparent" : faint} 50%)`,
        backgroundSize: "200% 100%",
        backgroundPosition: `${(1 - fill) * 100}% 0`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        transition: "background-position 120ms linear, transform 200ms ease-out",
      }
    : { color: lit ? accent : outline ? "transparent" : faint, transition: "color 300ms ease-out, transform 200ms ease-out" };
  return (
    <span
      className="inline-block mr-[0.28em] motion-reduce:transition-none"
      style={{
        ...paint,
        WebkitTextStroke: outline ? `max(1px, 0.025em) ${lit ? accent : faint}` : undefined,
        // The page's text halo would show through see-through glyphs (karaoke
        // fill, outline), so drop it on those.
        textShadow: sweeping || (outline && !lit) ? "none" : undefined,
        filter: effect === "glow" && lit ? `drop-shadow(0 0 0.18em ${accent})` : undefined,
        transform: effect === "pop" && active ? "translateY(-0.06em) scale(1.1)" : undefined,
        transformOrigin: "50% 80%",
      }}
    >
      {text}
    </span>
  );
}

// Scroll layout: a sliding window. The current line sits at the top and
// reveals; as many coming lines as fit are shown below at the same size. When a
// line finishes the stack slides up.
// Focus layout: one big line in the middle, the next line small underneath.
export default function PartyLyrics({
  lines, activeIdx, positionMs, plain, loading, accent, faint,
  reveal = "word", scale = 1, fontKey = "", layout = "scroll", caps = true, align = "left", effect = "none",
}: Props) {
  const vpRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [ty, setTy] = useState(0);
  // How many lines past the current one to reveal — measured so the (fixed-size)
  // lyrics box is filled regardless of how short the lines are. Always ≥ 1 so
  // there's a "next" line even when lines are tall.
  const [maxRel, setMaxRel] = useState(1);

  const idx = activeIdx < 0 ? 0 : activeIdx;

  useEffect(() => {
    if (layout !== "scroll") return;
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
    document.fonts?.ready.then(measure).catch(() => {}); // a newly picked font may still be loading
    // The lyrics box can resize without the window resizing, so watch the box itself.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (vpRef.current) ro?.observe(vpRef.current);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [idx, lines, scale, fontKey, layout, caps, align]);

  if (loading) return <Empty>loading lyrics</Empty>;

  const textStyle = (mult: number): CSSProperties => ({
    fontFamily: "var(--font-lyric)",
    fontSize: `calc(${BASE_SIZE} * ${scale * mult} * var(--lyric-fix, 1))`,
    textAlign: align,
  });
  const textClass = `${caps ? "uppercase tracking-tight" : ""} leading-[0.98]`;

  if (lines && lines.length > 0) {
    const started = activeIdx >= 0;
    const times = wordTimes(lines, idx);
    const fills = wordFills(times, positionMs, started, reveal);
    // the word being sung right now (for the pop effect)
    const activeWord = started ? times.findIndex((t) => positionMs >= t.start && positionMs < t.end) : -1;

    const renderLine = (text: string, lineFills: number[] | null, isCurrent = !!lineFills) =>
      splitWords(text).map((w, wi) => (
        <Word
          key={wi}
          text={w}
          fill={lineFills ? lineFills[wi] ?? 0 : 0}
          current={isCurrent}
          active={isCurrent && wi === activeWord && reveal !== "line"}
          accent={accent}
          faint={faint}
          reveal={reveal}
          effect={effect}
        />
      ));

    if (layout === "focus") {
      return <FocusLines lines={lines} idx={idx} fills={fills} renderLine={renderLine} textClass={textClass} textStyle={textStyle} align={align} measureKey={`${scale}|${fontKey}|${caps}|${align}`} />;
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
            return (
              <div
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                className="px-6 py-2.5 transition-opacity duration-[420ms] ease-out motion-reduce:transition-none"
                style={{ opacity: visible ? 1 : 0 }}
              >
                <p className={textClass} style={textStyle(1)}>
                  {renderLine(l.text, rel === 0 ? fills : null)}
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
        <p className={`${caps ? "uppercase" : ""} text-3xl xl:text-5xl leading-snug tracking-tight whitespace-pre-line w-full`} style={{ fontFamily: "var(--font-lyric)", overflowWrap: "anywhere", textAlign: align }}>
          {plain}
        </p>
      </div>
    );
  }

  return <Empty>no lyrics for this one</Empty>;
}

// One line: the current line big in the middle, the next one small under it.
// Lines are keyed by their index and only move with transforms, so when a line
// ends it slides up and fades while the next one grows up into its place,
// instead of the whole line being swapped out. Every line is laid out at full
// size (the small one is scaled down), so nothing re-wraps mid-move.
const NEXT_SCALE = 0.42;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function FocusLines({
  lines, idx, fills, renderLine, textClass, textStyle, align, measureKey,
}: {
  lines: LyricLine[];
  idx: number;
  fills: number[];
  renderLine: (text: string, fills: number[] | null, isCurrent?: boolean) => React.ReactNode;
  textClass: string;
  textStyle: (mult: number) => CSSProperties;
  align: "left" | "center";
  measureKey: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<number, HTMLDivElement>());
  const [box, setBox] = useState(0);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const window_ = [idx - 1, idx, idx + 1, idx + 2].filter((i) => i >= 0 && i < lines.length);

  useLayoutEffect(() => {
    const measure = () => {
      setBox(boxRef.current?.clientHeight ?? 0);
      const next: Record<number, number> = {};
      refs.current.forEach((el, i) => { next[i] = el.offsetHeight; });
      setHeights((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (boxRef.current) ro?.observe(boxRef.current);
    return () => ro?.disconnect();
  }, [idx, lines, measureKey]);

  const h = (i: number) => heights[i] ?? box * 0.25;
  const gap = h(idx) * 0.12;
  const curTop = (box - h(idx) - h(idx + 1) * NEXT_SCALE - gap) / 2; // current + next, centered together
  const place = (i: number): { y: number; s: number; o: number } => {
    const rel = i - idx;
    if (rel === 0) return { y: curTop, s: 1, o: 1 };
    if (rel === 1) return { y: curTop + h(idx) + gap, s: NEXT_SCALE, o: 1 };
    if (rel < 0) return { y: curTop - h(i) * 0.75, s: 0.9, o: 0 };
    return { y: curTop + h(idx) + gap + h(idx + 1) * NEXT_SCALE + gap, s: NEXT_SCALE * 0.9, o: 0 };
  };

  return (
    <div ref={boxRef} className="relative h-full overflow-hidden">
      {window_.map((i) => {
        const { y, s, o } = place(i);
        const rel = i - idx;
        return (
          <div
            key={i}
            ref={(el) => { if (el) refs.current.set(i, el); else refs.current.delete(i); }}
            className="absolute inset-x-0 top-0 px-6 motion-reduce:transition-none"
            style={{
              transform: `translateY(${y}px) scale(${s})`,
              transformOrigin: align === "center" ? "50% 0" : "0 0",
              opacity: o,
              transition: `transform 650ms ${EASE}, opacity 450ms ease-out`,
            }}
          >
            <p className={textClass} style={textStyle(1.35)}>
              {/* the line leaving stays lit as it slides away */}
              {renderLine(lines[i].text, rel === 0 ? fills : rel < 0 ? splitWords(lines[i].text).map(() => 1) : null, rel === 0)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
