"use client";

// Eased values for the library backgrounds. Their props update live (no
// remount), so instead of snapping to a new song's colors or a new speed we
// feed them a value that glides there. Re-renders only while a change is in
// flight (~30 per second), then stops.

import { useEffect, useRef, useState } from "react";
import { mixPalette, type ScenePalette } from "./color";

const STEP_MS = 33;

export function useEasedNumber(target: number, ms = 400): number {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (cur.current === target) return;
    const from = cur.current;
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3); // ease out
      cur.current = from + (target - from) * e;
      setV(cur.current);
      if (k >= 1) clearInterval(id);
    }, STEP_MS);
    return () => clearInterval(id);
  }, [target, ms]);
  return v;
}

export function useEasedPalette(target: ScenePalette, ms = 1200): ScenePalette {
  const [p, setP] = useState(target);
  const cur = useRef(target);
  const key = `${target.c1}${target.c2}${target.c3}${target.accent}${target.surface}`;
  useEffect(() => {
    const from = cur.current;
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      cur.current = k >= 1 ? target : mixPalette(from, target, k);
      setP(cur.current);
      if (k >= 1) clearInterval(id);
    }, STEP_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);
  return p;
}
