"use client";

/* Hallmark · macrostructure: Editorial Dashboard (studied DNA) · genre: editorial
 * tone: editorial · color: album-adaptive via Huelix toolkit (Surface/Body/Primary/Accent roles)
 * type: Anton (title) + Inter (UI) + Bitcount Single (lyrics)
 * lyrics: word-by-word build · /party fullscreen dashboard
 *
 * This page only wires things together. The pieces live in:
 *   hooks/usePartyPlayback  current track, queue, position clock, transport
 *   hooks/useDemoPlayback   sample songs for /party?demo (no Spotify needed)
 *   hooks/useAlbumTheme     album palette → theme, Govee light sync
 *   hooks/useDisplayConfig  saved look (DisplayConfig), device settings, title/info
 *   components/party/*      background, panels, layouts, widgets, settings drawer */

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Anton, Inter } from "next/font/google";
import { LayoutGroup, MotionConfig } from "framer-motion";
import { rgba } from "@/lib/albumTheme";
import type { LyricLine } from "@/lib/lyrics";
import { effectiveConfig } from "@/lib/display/config";
import { loadFonts } from "@/lib/display/fonts";
import { LYRIC_SCALE, panelClass, textHalo, themeCssVars } from "@/lib/display/theme";
import { DisplayConfigProvider, useDisplayConfig } from "@/hooks/useDisplayConfig";
import { usePartyPlayback } from "@/hooks/usePartyPlayback";
import { useDemoPlayback } from "@/hooks/useDemoPlayback";
import { useAlbumTheme, useGoveeSync } from "@/hooks/useAlbumTheme";
import { useLyricOffsetKeys } from "@/hooks/useLyricOffsetKeys";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useIdle } from "@/hooks/useIdle";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useLyrics } from "@/hooks/useLyrics";
import PartyLyrics from "@/components/PartyLyrics";
import DisplayBackground from "@/components/party/DisplayBackground";
import CornerControls from "@/components/party/CornerControls";
import LyricOffsetToast from "@/components/party/LyricOffsetToast";
import AlbumArt from "@/components/party/AlbumArt";
import NowPlayingCard from "@/components/party/NowPlayingCard";
import Transport from "@/components/party/Transport";
import TitleBlock from "@/components/party/TitleBlock";
import UpNextBar from "@/components/party/UpNextBar";
import ClassicLayout from "@/components/party/layouts/ClassicLayout";
import HeroLayout from "@/components/party/layouts/HeroLayout";
import SettingsDrawer from "@/components/party/settings/SettingsDrawer";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

const IDLE_MS = 3000;

function activeLineIdx(lines: LyricLine[] | null, positionMs: number) {
  if (!lines) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) idx = i;
    else break;
  }
  return idx;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

export default function PartyPage() {
  return (
    <DisplayConfigProvider>
      <PartyDashboard />
    </DisplayConfigProvider>
  );
}

function PartyDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = session?.accessToken ?? "";
  const { config: savedConfig, device, setDevice } = useDisplayConfig();
  const config = useMemo(() => effectiveConfig(savedConfig, device), [savedConfig, device]);

  // /party?demo plays sample songs instead of Spotify and works signed out.
  // Read after mount (null until then) so server and client render the same.
  const [demo, setDemo] = useState<boolean | null>(null);
  useEffect(() => setDemo(new URLSearchParams(window.location.search).has("demo")), []);

  useEffect(() => {
    if (demo === false && status === "unauthenticated") router.push("/");
  }, [demo, status, router]);

  const live = usePartyPlayback(demo ? "" : token);
  const sample = useDemoPlayback(!!demo);
  const playback = demo ? sample : live;
  const { current, upcoming, positionMs } = playback;
  const theme = useAlbumTheme(current?.albumArt, config.color);
  useGoveeSync(theme, config.lights.govee);
  useWakeLock(device.keepAwake);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const toggleSettings = useCallback(() => setSettingsOpen((o) => !o), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const idle = useIdle(IDLE_MS);
  const chromeHidden = idle && !settingsOpen; // hide cursor + corner buttons

  // Fetch the picked lyric font (only that one) from Google Fonts.
  useEffect(() => loadFonts([config.lyrics.font]), [config.lyrics.font]);

  // S = settings, F = fullscreen, Esc = close settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "s") { e.preventDefault(); setSettingsOpen((o) => !o); }
      else if (k === "f") { e.preventDefault(); toggleFullscreen(); }
      else if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  // Lyric timing offset (device.lyricOffsetMs), in ms. Spotify reports the
  // *stream* position, but on a TV / BT speaker / Spotify Connect target the
  // sound you actually hear lags that by the device's output + buffering
  // latency — so the lyrics drift ahead. The -600ms default pulls them back;
  // live-tune with ← / → at the venue (off while the settings drawer is open).
  const lyricLead = device.lyricOffsetMs;
  const setLyricLead = useCallback((ms: number) => setDevice({ lyricOffsetMs: ms }), [setDevice]);
  const leadToast = useLyricOffsetKeys(lyricLead, setLyricLead, !settingsOpen);

  const lyrics = useLyrics(current);
  const lyricPos = positionMs + lyricLead;
  const aIdx = activeLineIdx(lyrics.synced, lyricPos);

  // Only time-synced lyrics drive the center column. Plain-only or truly-absent
  // lyrics fall back to the hero layout (big cover + player, enlarged queue).
  // lyrics.mode "always" keeps the lyrics column; "off" always uses the hero.
  const hasSynced = (lyrics.synced?.length ?? 0) > 0;
  const lyricsMode = config.lyrics.mode;
  const showLyrics = lyricsMode === "always" || (lyricsMode === "auto" && (lyrics.loading || hasSynced));
  const billboard = config.background.type === "billboard";
  const upNextCount = config.widgets.upNext.count;
  const maxUpNext = upNextCount === "auto" ? (showLyrics ? 5 : 6) : upNextCount;

  if (demo === null || (!demo && status === "loading")) {
    return <div className="flex items-center justify-center h-screen bg-white text-black/40 text-sm">Loading…</div>;
  }

  const w = config.widgets;
  const halo = textHalo(theme);
  const glass = panelClass(config.panels.style);
  const hasSide = w.clock.show || w.clock.date || w.title.show || w.info;
  const side = hasSide ? <TitleBlock halo={halo} isFullscreen={isFullscreen} /> : null;
  const cover = <AlbumArt track={current} theme={theme} />;
  // Upcoming (not yet sung) lyric words; brighter on forced dark so they don't sink.
  const faint = rgba(theme.ink, config.color.mode === "dark" ? 0.5 : 0.28);

  return (
    <div
      className={`${display.variable} ${sans.variable} relative h-screen w-screen overflow-hidden flex transition-colors`}
      style={{ ...themeCssVars(theme, config), cursor: chromeHidden ? "none" : undefined }}
    >
      {/* The display itself. Its own box (not the window) so it can shrink
          beside the docked settings panel. */}
      <div className="relative flex-1 min-w-0 h-full overflow-hidden flex flex-col">
      <DisplayBackground
        theme={theme}
        background={config.background}
        albumArt={current?.albumArt}
        colorMode={config.color.mode}
        track={current}
        lyricLine={lyrics.synced?.[aIdx]?.text ?? null}
        playing={playback.playing}
        lowPower={device.lowPower}
      />
      <CornerControls
        hidden={chromeHidden}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onOpenSettings={toggleSettings}
      />
      <LyricOffsetToast visible={leadToast} offsetMs={lyricLead} theme={theme} />
      {demo && (
        <div
          className="absolute top-4 left-4 z-30 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] transition-opacity duration-500"
          style={{ background: rgba(theme.ink, 0.08), color: rgba(theme.ink, 0.7), opacity: chromeHidden ? 0 : 1 }}
        >
          Demo · sample songs
        </div>
      )}

      {/* Top region — lyrics layout (3-col) morphs to/from hero layout (cover +
          one long player bubble). Framer Motion shared-layout (layoutId) slides
          and resizes the cover/now-playing/timeline panels between the two. */}
      <MotionConfig reducedMotion="user">
        <LayoutGroup>
          {billboard ? (
            // The billboard is the now-playing display (cover and song, or the
            // lyric line), so only the corner column stays on top of it.
            <div className="relative z-10 flex-1 min-h-0 flex justify-end px-8 lg:px-10 pt-9 pb-6">
              {side && <div className="w-[300px] min-h-0 flex flex-col">{side}</div>}
            </div>
          ) : showLyrics ? (
            <ClassicLayout
              key="lyrics-layout"
              glass={glass}
              halo={halo}
              cover={cover}
              nowPlaying={w.nowPlaying ? <NowPlayingCard track={current} /> : null}
              transport={w.transport ? <Transport playback={playback} /> : null}
              lyrics={
                <PartyLyrics
                  lines={lyrics.synced}
                  activeIdx={aIdx}
                  positionMs={lyricPos}
                  plain={lyrics.plain}
                  loading={lyrics.loading}
                  accent={theme.lyric}
                  faint={faint}
                  reveal={config.lyrics.reveal}
                  scale={LYRIC_SCALE[config.lyrics.size]}
                  fontKey={config.lyrics.font}
                  layout={config.lyrics.layout}
                  caps={config.lyrics.caps}
                  align={config.lyrics.align}
                  effect={config.lyrics.effect}
                />
              }
              side={side}
            />
          ) : (
            <HeroLayout
              key="hero-layout"
              glass={glass}
              cover={cover}
              nowPlaying={w.nowPlaying ? <NowPlayingCard track={current} big /> : null}
              transport={w.transport ? <Transport playback={playback} big /> : null}
              side={side}
            />
          )}
        </LayoutGroup>
      </MotionConfig>

      {/* BOTTOM — up next, floating glass bar */}
      {w.upNext.show && maxUpNext > 0 && (
        <UpNextBar upcoming={upcoming} max={maxUpNext} roomy={!showLyrics} panel={config.panels.style} />
      )}
      </div>

      <SettingsDrawer open={settingsOpen} onClose={closeSettings} theme={theme} albumArt={current?.albumArt} />
    </div>
  );
}
