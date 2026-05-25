"use client";

interface Props {
  offsetPx: number;
}

// Pill is ~44px wide, centered at calc(50% - 36px) within the song column.
// Left segment stops 6px before the pill left edge; right segment starts 6px after.
// pill_half=22, gap=6 → left ends at right:calc(50%+64px), right starts at left:calc(50%-8px)

export default function NowIndicator({ offsetPx }: Props) {
  if (offsetPx < 0) return null;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: offsetPx }}
    >
      {/* Left line segment: from time column left edge to just before LIVE pill */}
      <div
        className="absolute h-[2px] bg-red-500 -translate-y-px"
        style={{ left: -72, right: "calc(50% + 64px)", opacity: 0.9, mixBlendMode: "screen" }}
      />
      {/* Right line segment: from just after LIVE pill to right edge */}
      <div
        className="absolute h-[2px] bg-red-500 -translate-y-px"
        style={{ left: "calc(50% - 8px)", right: 0, opacity: 0.9, mixBlendMode: "screen" }}
      />
      {/* Dot — sits between the green border and the song text */}
      <div className="absolute left-[10px] -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" />
      {/* LIVE pill — centered on the full line */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 px-1.5 py-px rounded bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-bold tracking-widest leading-none"
        style={{ left: "calc(50% - 36px)" }}
      >
        LIVE
      </div>
    </div>
  );
}
