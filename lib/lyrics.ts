export interface LyricLine {
  timeMs: number;
  text: string;
}

// Matches LRC timestamps like [01:23.45] or [01:23] (also tolerates [mm:ss:xx])
const TIMESTAMP = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

// Parses an LRC string into time-sorted lines. A single line may carry several
// timestamps (repeated lyrics) — each becomes its own entry.
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split("\n")) {
    const matches = [...raw.matchAll(TIMESTAMP)];
    if (matches.length === 0) continue;
    const text = raw.replace(TIMESTAMP, "").trim();
    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const frac = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      lines.push({ timeMs: (min * 60 + sec) * 1000 + frac, text });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}
