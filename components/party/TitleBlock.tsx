"use client";

import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import GlassPanel from "@/components/GlassPanel";
import { useDisplayConfig } from "@/hooks/useDisplayConfig";
import type { InfoItem } from "@/lib/display/config";
import DateClock from "./DateClock";
import { MORPH } from "./morph";
import { FONT_SIZE_FIX, lyricFont } from "@/lib/display/fonts";

const editBase =
  "bg-transparent outline-none focus:bg-[color:var(--ink-05)] rounded transition-colors placeholder:text-[color:var(--ink-25)]";

// Right column: date/clock + editable party title + editable info rows. The
// same layoutId in both layouts lets Framer slide it across the layout swap.
function TitleBlock({ halo, isFullscreen }: { halo: string; isFullscreen: boolean }) {
  const { config, content, loaded, setContent } = useDisplayConfig();
  const { title, info } = content;
  const titleFont = config.widgets.title.font;
  const measureKey = `${title}|${titleFont}`;
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const measuredFor = useRef<string | null>(null);

  // Auto-grow the title textarea to fit its wrapped lines, but treat the result
  // as a persisted constant. We only re-measure when the title *text* changes —
  // never on layout remounts. The lyrics/hero layout swap unmounts and remounts
  // this block (both columns are 300px wide, so the wrapping is identical), and
  // measuring mid-morph used to clamp a 3-line title back to 1 line. On mount, a
  // saved height already matches the saved text, so it's adopted as-is; the
  // height set when you typed the title just stays — across the transition and
  // across reloads. `measuredFor` tracks the text the current height belongs to.
  useEffect(() => {
    const el = titleRef.current;
    if (!el || !loaded) return;
    if (measuredFor.current === null && content.titleHeight !== null) {
      measuredFor.current = measureKey;
      return;
    }
    if (measuredFor.current === measureKey) return;
    let cancelled = false;
    const measure = () => {
      // A late callback (fonts loading, next frame) can land after the layout
      // swap removed this textarea; a detached element measures 0, which used
      // to get saved and collapse the title. Ignore those.
      if (cancelled || !el.isConnected) return;
      el.style.height = "auto";
      const h = el.scrollHeight;
      if (h <= 0) return;
      el.style.height = `${h}px`;
      measuredFor.current = measureKey;
      setContent({ titleHeight: h });
    };
    measure();
    const raf = requestAnimationFrame(measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => { cancelled = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureKey, loaded]);

  const saveInfo = (next: InfoItem[]) => setContent({ info: next });
  const updateInfo = (i: number, field: keyof InfoItem, v: string) =>
    saveInfo(info.map((row, j) => (j === i ? { ...row, [field]: v } : row)));
  const addInfo = () => saveInfo([...info, { label: "", time: "" }]);
  const removeInfo = (i: number) => saveInfo(info.filter((_, j) => j !== i));
  const { clock, title: titleW } = config.widgets;

  return (
    <motion.section layout layoutId="rightcol" transition={MORPH} className="flex flex-col min-h-0 gap-5">
      <div>
        {(clock.show || clock.date) && <DateClock className="mt-3 mb-1 space-y-0.5" clock={clock} />}
        {titleW.show && (<>
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => setContent({ title: e.target.value })}
          placeholder="PARTY TITLE"
          spellCheck={false}
          rows={1}
          className={`${editBase} font-black uppercase tracking-tight leading-[1.05] break-words w-full resize-none overflow-hidden px-2 py-2`}
          style={{
            fontFamily: lyricFont(titleW.font).family,
            fontSize: `calc(clamp(3rem, 3.2vw, 3.75rem) * ${FONT_SIZE_FIX[titleW.font] ?? 1})`,
            color: "var(--primary)",
            textShadow: halo,
            height: content.titleHeight ?? undefined,
          }}
        />
        {titleW.divider && <div className="w-10 border-t mt-5" style={{ borderColor: "var(--accent)" }} />}
        </>)}
      </div>

      {/* INFO (editable list) */}
      {config.widgets.info && (
      <GlassPanel className="p-5" panel={config.panels.style}>
        {config.widgets.infoHeading && <div className="text-xs font-bold uppercase tracking-[0.12em] mb-3">Info</div>}
        <div className="space-y-1.5">
          {info.map((row, i) => {
            // In fullscreen, hide fully-empty rows (editing-only placeholders).
            if (isFullscreen && !row.label.trim() && !row.time.trim()) return null;
            return (
              <div key={i} className="group flex items-center gap-2">
                <input
                  value={row.label}
                  onChange={(e) => updateInfo(i, "label", e.target.value)}
                  placeholder="ITEM"
                  spellCheck={false}
                  className={`${editBase} flex-1 min-w-0 text-sm uppercase tracking-wide`}
                />
                {config.widgets.infoTimes && (!isFullscreen || row.time.trim()) && (
                  <input
                    value={row.time}
                    onChange={(e) => updateInfo(i, "time", e.target.value)}
                    placeholder="TIME"
                    spellCheck={false}
                    className={`${editBase} w-16 text-sm text-right tabular-nums`}
                  />
                )}
                {!isFullscreen && (
                  <button
                    onClick={() => removeInfo(i)}
                    className="opacity-0 group-hover:opacity-100 text-[color:var(--ink-30)] hover:text-[color:var(--ink)] text-xs w-4 shrink-0 transition-opacity"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          {!isFullscreen && (
            <button onClick={addInfo} className="text-xs uppercase tracking-wide text-[color:var(--ink-35)] hover:text-[color:var(--ink)] transition-colors pt-1">
              + Add item
            </button>
          )}
        </div>
      </GlassPanel>
      )}
    </motion.section>
  );
}

// Memoized: the page re-renders ~10x a second for the playback clock, and this
// doesn't need to unless its own props change.
export default memo(TitleBlock);
