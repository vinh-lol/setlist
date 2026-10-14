import type { SpotifyTrack } from "@/lib/types";

// Content only (no panel), so it can sit in its own bubble (lyrics layout) or
// share one long bubble (hero). `big` scales the copy up for the hero layout,
// where there's far more room than in the lyrics layout's slim left column.
export default function NowPlayingCard({ track, big = false }: { track: SpotifyTrack | null; big?: boolean }) {
  return (
    <>
      <p className={`font-bold uppercase tracking-[0.12em] text-[color:var(--ink-40)] ${big ? "text-base mb-4" : "text-[11px] mb-2"}`}>Now Playing</p>
      <p className={`font-bold uppercase tracking-tight leading-[1.02] pb-[0.06em] break-words ${big ? "text-[clamp(1.75rem,3.4vw,3.25rem)] line-clamp-3" : "text-xl line-clamp-2"}`}>{track?.name ?? "Nothing playing"}</p>
      <p className={`text-[color:var(--ink-65)] break-words ${big ? "text-2xl xl:text-3xl mt-4 line-clamp-2" : "text-sm mt-1 line-clamp-2"}`}>{track?.artists.join(", ") ?? "Start a playlist"}</p>
      <p className={`text-[color:var(--ink-40)] uppercase tracking-wide truncate ${big ? "text-base mt-2" : "text-[11px] mt-0.5"}`}>{track?.albumName ?? ""}</p>
    </>
  );
}
