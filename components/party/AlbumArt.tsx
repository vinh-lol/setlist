import { memo } from "react";
import { rgba, type AlbumTheme } from "@/lib/albumTheme";
import type { SpotifyTrack } from "@/lib/types";

// The cover fills the largest square that fits its box (100cqmin = the
// shorter side of the box, via container query units), so it never sits small
// inside a big panel and never stretches out of square.
function AlbumArt({ track, theme }: { track: SpotifyTrack | null; theme: AlbumTheme }) {
  return (
    <div className="w-full h-full min-h-0 flex items-center justify-center [container-type:size]">
      {track?.albumArt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.albumArt}
          alt={track.albumName}
          className="aspect-square max-w-full max-h-full object-cover rounded-xl transition-shadow duration-1000"
          style={{ width: "100cqmin", boxShadow: `0 24px 50px -28px ${rgba(theme.accent, 0.4)}, 0 6px 18px -14px ${rgba(theme.ink, 0.22)}` }}
        />
      ) : (
        <div className="aspect-square max-w-full max-h-full bg-[color:var(--ink-05)] rounded-xl" style={{ width: "100cqmin" }} />
      )}
    </div>
  );
}

// Memoized: the page re-renders ~10x a second for the playback clock, and this
// doesn't need to unless its own props change.
export default memo(AlbumArt);
