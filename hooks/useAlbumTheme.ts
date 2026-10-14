"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeAlbum, buildTheme, DEFAULT_THEME, type AlbumTheme } from "@/lib/albumTheme";
import type { DisplayConfig } from "@/lib/display/config";

type Analysis = Awaited<ReturnType<typeof analyzeAlbum>>;

// Theme for the display. With color.source "album" it adapts to the cover via
// the Huelix toolkit; with "fixed" it's built the same way from three picked
// colors. Mode (auto/dark/light) and intensity re-tune the theme instantly
// without re-analyzing the cover.
export function useAlbumTheme(albumArt: string | undefined, color: DisplayConfig["color"]): AlbumTheme {
  const [analysis, setAnalysis] = useState<{ url: string; data: Analysis } | null>(null);
  const useAlbum = color.source === "album";

  useEffect(() => {
    if (!useAlbum || !albumArt) { setAnalysis(null); return; }
    let active = true;
    analyzeAlbum(albumArt)
      .then((data) => { if (active) setAnalysis({ url: albumArt, data }); })
      .catch(() => { if (active) setAnalysis(null); });
    return () => { active = false; };
  }, [albumArt, useAlbum]);

  const fixedKey = color.fixed.colors.join(",");
  return useMemo(() => {
    const opts = { mode: color.mode, intensity: color.intensity };
    if (!useAlbum) {
      const cols = color.fixed.colors;
      return buildTheme(cols, cols, [], opts);
    }
    if (!analysis) return DEFAULT_THEME;
    const { palette, candidates, counts } = analysis.data;
    return buildTheme(palette, candidates, counts, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, useAlbum, fixedKey, color.mode, color.intensity]);
}

// Mirror the theme colors onto a Govee light via /api/govee. Fires once per
// palette change (≈ per song); no-ops silently when Govee isn't configured
// server-side or the call fails, so it never disturbs the dashboard.
// mode "accent" paints every segment the single accent color.
export function useGoveeSync(theme: AlbumTheme, govee: DisplayConfig["lights"]["govee"]) {
  const colors = govee.mode === "accent" ? [theme.accent, theme.accent, theme.accent] : theme.gradient;
  const goveeKey = `${colors.join(",")}|${theme.accent}`;
  useEffect(() => {
    if (!govee.enabled || !theme.gradient.length) return;
    fetch("/api/govee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colors, accent: theme.accent }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goveeKey, govee.enabled]);
}
