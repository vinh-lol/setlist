import { formatDuration } from "@/lib/timeline";
import type { PartyPlayback } from "@/hooks/usePartyPlayback";

// Progress bar + prev / play-pause / next. Content only, like NowPlayingCard.
export default function Transport({ playback, big = false }: { playback: PartyPlayback; big?: boolean }) {
  const { current, positionMs, pct, playing, prev, next, playPause } = playback;
  const side = big ? 34 : 22;
  const main = big ? 54 : 30;
  return (
    <>
      <div className={`flex items-center justify-between text-[color:var(--ink-40)] tabular-nums ${big ? "text-base mb-3" : "text-[11px] mb-2"}`}>
        <span>{formatDuration(Math.min(positionMs, current?.duration_ms ?? 0))}</span>
        <span>{current ? formatDuration(current.duration_ms) : "0:00"}</span>
      </div>
      <div className={`bg-[color:var(--ink-10)] rounded-full overflow-hidden ${big ? "h-2.5" : "h-1"}`}>
        <div className="h-full transition-[width] duration-200 ease-linear" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
      <div className={`flex items-center justify-center ${big ? "gap-14 mt-9" : "gap-8 mt-4"}`}>
        <button onClick={prev} title="Previous" className="text-[color:var(--ink-65)] hover:text-[color:var(--ink)] transition-colors">
          <svg width={side} height={side} viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="2.5" height="14" rx="1" /><path d="M20 5.5v13L9.5 12 20 5.5z" /></svg>
        </button>
        <button onClick={playPause} title={playing ? "Pause" : "Play"} className="hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
          {playing ? (
            <svg width={main} height={main} viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.5" height="14" rx="1" /><rect x="14" y="5" width="3.5" height="14" rx="1" /></svg>
          ) : (
            <svg width={main} height={main} viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5v13L19 12 7 5.5z" /></svg>
          )}
        </button>
        <button onClick={next} title="Next" className="text-[color:var(--ink-65)] hover:text-[color:var(--ink)] transition-colors">
          <svg width={side} height={side} viewBox="0 0 24 24" fill="currentColor"><path d="M4 5.5v13L14.5 12 4 5.5z" /><rect x="16.5" y="5" width="2.5" height="14" rx="1" /></svg>
        </button>
      </div>
    </>
  );
}
