"use client";

// Live lyric-sync nudge: ← pulls lyrics later (more behind the audio), →
// pushes them earlier. ↓/0 resets. Lets you dial out TV/speaker output lag at
// the venue without a redeploy. Ignored while editing a text field. Returns
// whether the readout toast should be visible right now.

import { useEffect, useRef, useState } from "react";

const LEAD_STEP_MS = 100;

export function useLyricOffsetKeys(offsetMs: number, setOffsetMs: (ms: number) => void, enabled = true): boolean {
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      let next: number | null = null;
      if (e.key === "ArrowLeft") next = offsetMs - LEAD_STEP_MS;
      else if (e.key === "ArrowRight") next = offsetMs + LEAD_STEP_MS;
      else if (e.key === "ArrowDown" || e.key === "0") next = 0;
      if (next === null) return;
      e.preventDefault();
      setOffsetMs(next);
      setToast(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(false), 1600);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offsetMs, setOffsetMs, enabled]);

  return toast;
}
