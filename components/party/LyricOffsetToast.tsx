import { rgba, type AlbumTheme } from "@/lib/albumTheme";

// Lyric-sync nudge readout — fades in while adjusting with ← / → (↓ resets).
export default function LyricOffsetToast({ visible, offsetMs, theme }: { visible: boolean; offsetMs: number; theme: AlbumTheme }) {
  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full text-xs tracking-[0.18em] uppercase pointer-events-none transition-opacity duration-300"
      style={{
        opacity: visible ? 1 : 0,
        background: rgba(theme.ink, 0.08),
        color: rgba(theme.ink, 0.75),
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      Lyrics {offsetMs === 0 ? "in sync" : `${offsetMs > 0 ? "+" : ""}${(offsetMs / 1000).toFixed(1)}s`}
      <span style={{ opacity: 0.5 }}> · ← later · → earlier · ↓ reset</span>
    </div>
  );
}
