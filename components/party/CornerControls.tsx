// Top-right buttons: display settings + fullscreen. Fade out when the screen
// is idle so nothing sits on top of the display; any mouse or key brings them back.
export default function CornerControls({
  hidden,
  isFullscreen,
  onToggleFullscreen,
  onOpenSettings,
}: {
  hidden: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
}) {
  const btn = "p-2 rounded-lg text-[color:var(--ink-30)] hover:text-[color:var(--ink)] hover:bg-[color:var(--ink-05)] transition-colors";
  return (
    <div
      className="absolute top-4 right-4 z-30 flex items-center gap-1 transition-opacity duration-500"
      style={{ opacity: hidden ? 0 : 1, pointerEvents: hidden ? "none" : "auto" }}
    >
      <button onClick={onOpenSettings} title="Display settings (S)" aria-label="Display settings" className={btn}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
      </button>
      <button onClick={onToggleFullscreen} title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"} aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} className={btn}>
        {isFullscreen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>
        )}
      </button>
    </div>
  );
}
