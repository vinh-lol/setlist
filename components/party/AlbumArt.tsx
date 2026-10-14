import { rgba, type AlbumTheme } from "@/lib/albumTheme";
import type { SpotifyTrack } from "@/lib/types";

export default function AlbumArt({ track, theme }: { track: SpotifyTrack | null; theme: AlbumTheme }) {
  if (!track?.albumArt) return <div className="w-full aspect-square bg-[color:var(--ink-05)] rounded-xl" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={track.albumArt}
      alt={track.albumName}
      className="max-h-full max-w-full w-auto object-contain rounded-xl transition-shadow duration-1000"
      style={{ boxShadow: `0 24px 50px -28px ${rgba(theme.accent, 0.4)}, 0 6px 18px -14px ${rgba(theme.ink, 0.22)}` }}
    />
  );
}
