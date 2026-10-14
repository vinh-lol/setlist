"use client";

import { useEffect } from "react";

// Keeps the screen from dimming or sleeping while the display is open, using
// the Screen Wake Lock API. The browser drops the lock whenever the tab is
// hidden, so it's re-requested when the tab comes back. Silently does nothing
// where the API isn't supported (it needs HTTPS or localhost).
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      } catch {}
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}
