import GlassPanel from "@/components/GlassPanel";
import { formatDuration } from "@/lib/timeline";
import type { SpotifyTrack } from "@/lib/types";
import type { PanelStyle } from "@/lib/display/config";

// Floating glass bar along the bottom. `roomy` = hero layout (no lyrics), which
// gets one more column and slightly bigger covers.
export default function UpNextBar({
  upcoming,
  max,
  roomy,
  panel,
}: {
  upcoming: SpotifyTrack[];
  max: number;
  roomy: boolean;
  panel: PanelStyle;
}) {
  return (
    <div className="relative z-10 px-8 lg:px-10 pb-6">
      <GlassPanel className="px-6 py-4 flex items-center gap-8" panel={panel}>
        <div className="flex items-center gap-3 shrink-0 text-sm font-bold uppercase tracking-[0.1em]">
          Up Next <span className="text-[color:var(--ink-40)]">→</span>
        </div>
        <div className={`flex-1 grid grid-cols-2 md:grid-cols-3 gap-5 ${roomy ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
          {upcoming.length === 0 && <p className="text-[color:var(--ink-30)] text-sm uppercase tracking-wide">Queue is empty</p>}
          {upcoming.slice(0, max).map((track, i) => (
            <div key={track.playId ?? track.id + "-" + i} className="flex gap-3 items-start min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={track.albumArt} alt="" className={`${roomy ? "w-16 h-16" : "w-14 h-14"} object-cover rounded-md shrink-0 transition-all duration-300`} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] tabular-nums font-bold" style={{ color: "var(--accent)" }}>{String(i + 1).padStart(2, "0")}</div>
                <p className="font-bold uppercase tracking-tight text-sm leading-tight truncate">{track.name}</p>
                <p className="text-[11px] text-[color:var(--ink-50)] uppercase tracking-wide truncate">{track.artists.join(", ")}</p>
                <p className="text-[11px] text-[color:var(--ink-40)] tabular-nums">{formatDuration(track.duration_ms)}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}
