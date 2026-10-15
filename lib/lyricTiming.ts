// When each word of a lyric line is sung.
//
// Most synced lyrics (LRCLIB, like Spotify's own) only time whole lines. Apple
// Music and Musixmatch "richsync" time every word, but that data isn't open.
// So: if the line carries real word times (enhanced LRC), use them; otherwise
// estimate. The estimate counts syllables (a much better proxy for sung time
// than letters), assumes a typical singing pace, finishes the line a little
// before the next one starts (singers breathe), and holds the last word a bit
// longer. Lines that would take longer than the gap are squeezed to fit.

import type { LyricLine } from "./lyrics";

export interface WordTime { start: number; end: number }

const SYLLABLE_MS = 230;   // typical sung syllable at a mid tempo
const MIN_WORD_MS = 120;
const BREATH_MS = 250;     // finish this long before the next line
const LAST_WORD_BONUS = 1; // extra syllable-lengths on the final word (held notes)
const NO_NEXT_GAP_MS = 6000;

export const splitWords = (text: string) => (text || "♪").split(/\s+/).filter(Boolean);

/** Rough English syllable count: vowel groups, minus a silent final e. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-zÀ-ɏ]/g, "");
  if (!w) return 1; // numbers, symbols, other scripts: one beat
  const groups = w.match(/[aeiouyà-ÿ]+/g)?.length ?? 1;
  const silentE = w.length > 2 && /[^aeiouy]e$/.test(w) && !/le$/.test(w) ? 1 : 0;
  return Math.max(1, groups - silentE);
}

export function wordTimes(lines: LyricLine[], idx: number): WordTime[] {
  const cur = lines[idx];
  if (!cur) return [];
  const words = splitWords(cur.text);
  const nextStart = lines[idx + 1]?.timeMs ?? cur.timeMs + NO_NEXT_GAP_MS;

  // Real word times from the source.
  if (cur.words && cur.words.length === words.length) {
    return cur.words.map((w, i) => {
      const end = cur.words![i + 1]?.timeMs ?? Math.min(nextStart, w.timeMs + 900);
      return { start: w.timeMs, end: Math.max(w.timeMs + 60, end) };
    });
  }

  // Estimate.
  const weights = words.map((w, i) => syllables(w) + (i === words.length - 1 ? LAST_WORD_BONUS : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const room = Math.max(300, nextStart - cur.timeMs - BREATH_MS);
  const natural = Math.max(words.length * MIN_WORD_MS, total * SYLLABLE_MS);
  const dur = Math.min(room, natural);
  let t = cur.timeMs;
  return weights.map((wt) => {
    const len = (wt / total) * dur;
    const out = { start: t, end: t + len };
    t += len;
    return out;
  });
}

/**
 * How lit each word is at this moment (0..1). "word" lights a word at its
 * start; "sweep" fills it across its sung time; "line" lights everything.
 */
export function wordFills(times: WordTime[], positionMs: number, started: boolean, reveal: "word" | "sweep" | "line"): number[] {
  if (!started) return times.map(() => 0);
  if (reveal === "line") return times.map(() => 1);
  return times.map(({ start, end }) => {
    if (reveal === "sweep") return Math.min(1, Math.max(0, (positionMs - start) / (end - start)));
    return positionMs >= start ? 1 : 0;
  });
}
