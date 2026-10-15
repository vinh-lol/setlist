"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LyricLine } from "@/lib/lyrics";

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
const MAX_WORD_MS = 700;  // cap per-word reveal so a held note / instrumental gap can't crawl
const LAST_WORD_MS = 380; // steady fallback pace for the final line (no next line to time against)
const BASE_SIZE = "clamp(2.25rem, 4.6vw, 4.5rem)";

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center opacity-40 text-sm tracking-[0.2em] uppercase" style={{ fontFamily: "var(--font-sans)" }}>
      {children}
    </div>
  );
}

const splitWords = (text: string) => (text || "♪").split(/\s+/).filter(Boolean);

/**
 * How far each word of the current line is filled (0..1). The reveal is spread
 * across the line's real on-screen window (the gap to the next line), capped so
 * a held note can't make it crawl, and weighted by word length (a rough proxy
 * for how long each word is sung).
 */
function wordFills(lines: LyricLine[], idx: number, positionMs: number, started: boolean, reveal: Props["reveal"]): number[] {
  const cur = lines[idx];
  const nxt = lines[idx + 1] ?? null;
  const words = splitWords(cur?.text ?? "");
  if (!started) return words.map(() => 0);
  if (reveal === "line") return words.map(() => 1);
  const gap = nxt ? nxt.timeMs - cur.timeMs : Infinity;
  const dur = Number.isFinite(gap) ? Math.min(gap, words.length * MAX_WORD_MS) : words.length * LAST_WORD_MS;
  const frac = Math.min(1, Math.max(0, (positionMs - cur.timeMs) / dur));
  const lens = words.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length || w.length));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return lens.map((len) => {
    const start = acc / total, end = (acc + len) / total;
    acc += len;
    if (reveal === "sweep") return Math.min(1, Math.max(0, (frac - start) / (end - start)));
    return frac >= start ? 1 : 0; // word: lit as soon as its turn starts
  });
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
    const fills = wordFills(lines, idx, positionMs, started, reveal);
    // the word being sung right now (for the pop effect)
    const activeWord = reveal === "sweep" ? fills.findIndex((f) => f > 0 && f < 1) : fills.lastIndexOf(1);

    const renderLine = (text: string, lineFills: number[] | null) =>
      splitWords(text).map((w, wi) => (
        <Word
          key={wi}
          text={w}
          fill={lineFills ? lineFills[wi] ?? 0 : 0}
          current={!!lineFills}
          active={!!lineFills && wi === activeWord && reveal !== "line"}
          accent={accent}
          faint={faint}
          reveal={reveal}
          effect={effect}
        />
      ));

    if (layout === "focus") {
      const nxt = lines[idx + 1];
      return (
        <div className="relative h-full overflow-hidden flex flex-col justify-center px-6" style={{ alignItems: align === "center" ? "center" : "flex-start" }}>
          <p key={idx} className={`party-lyric-in w-full ${textClass}`} style={textStyle(1.35)}>
            {renderLine(lines[idx].text, fills)}
          </p>
          {nxt && (
            <p key={`n${idx}`} className={`party-lyric-in w-full mt-[0.6em] ${textClass}`} style={{ ...textStyle(0.5), color: faint }}>
              {splitWords(nxt.text).join(" ")}
            </p>
          )}
        </div>
      );
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
