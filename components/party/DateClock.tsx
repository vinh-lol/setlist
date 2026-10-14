"use client";

import { useEffect, useState } from "react";
import type { DisplayConfig } from "@/lib/display/config";

type ClockSettings = DisplayConfig["widgets"]["clock"];

// "MONDAY JUNE 27TH" — full weekday + month + ordinal day, uppercased.
const ordinal = (n: number) => {
  const s = ["TH", "ST", "ND", "RD"], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};
const fmtPartyDate = (d: Date) =>
  `${d.toLocaleDateString("en-US", { weekday: "long" })} ${d.toLocaleDateString("en-US", { month: "long" })} ${d.getDate()}${ordinal(d.getDate())}`.toUpperCase();

// Default "10:42:12" (24-hour with seconds); widgets.clock picks 12h / no seconds.
const fmtClock = (d: Date, clock: ClockSettings) =>
  clock.hour12
    ? d.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit", ...(clock.seconds ? { second: "2-digit" } : {}) })
    : d.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", ...(clock.seconds ? { second: "2-digit" } : {}) });

// Live date + clock shown above the title. Self-contained so its per-second tick
// only re-renders this block, not the whole dashboard.
export default function DateClock({ className, clock }: { className?: string; clock: ClockSettings }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={className} suppressHydrationWarning>
      {clock.show && <div className="text-xs font-bold uppercase tracking-[0.12em] px-2 tabular-nums">{fmtClock(now, clock)}</div>}
      {clock.date && <div className="text-xs font-bold uppercase tracking-[0.12em] px-2">{fmtPartyDate(now)}</div>}
    </div>
  );
}
