"use client";

import { useEffect, useState } from "react";
import { analyzeAlbum, buildTheme, DEFAULT_THEME, type AlbumTheme } from "@/lib/albumTheme";

// Adapt the whole theme to the album cover via the Huelix toolkit.
export function useAlbumTheme(albumArt: string | undefined): AlbumTheme {
  const [theme, setTheme] = useState<AlbumTheme>(DEFAULT_THEME);
  useEffect(() => {
    if (!albumArt) { setTheme(DEFAULT_THEME); return; }
    let active = true;
    analyzeAlbum(albumArt)
      .then(({ palette, candidates, counts }) => { if (active) setTheme(buildTheme(palette, candidates, counts)); })
      .catch(() => { if (active) setTheme(DEFAULT_THEME); });
    return () => { active = false; };
  }, [albumArt]);
  return theme;
}

// Mirror the album colors onto a Govee light via /api/govee. Fires once per
// palette change (≈ per song); no-ops silently when Govee isn't configured
// server-side or the call fails, so it never disturbs the dashboard.
export function useGoveeSync(theme: AlbumTheme, enabled: boolean) {
  const goveeKey = `${theme.gradient.join(",")}|${theme.accent}`;
  useEffect(() => {
    if (!enabled || !theme.gradient.length) return;
    fetch("/api/govee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colors: theme.gradient, accent: theme.accent }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goveeKey, enabled]);
}
