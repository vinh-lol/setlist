"use client";

/* Hallmark · macrostructure: Editorial Dashboard (studied DNA) · genre: editorial
 * tone: editorial · color: album-adaptive via Huelix toolkit (Surface/Body/Primary/Accent roles)
 * type: Anton (title) + Inter (UI) + Bitcount Single (lyrics)
 * lyrics: word-by-word build · /party fullscreen dashboard
 *
 * This page only wires things together. The pieces live in:
 *   hooks/usePartyPlayback  current track, queue, position clock, transport
 *   hooks/useAlbumTheme     album palette → theme, Govee light sync
 *   hooks/useDisplayConfig  saved look (DisplayConfig), device settings, title/info
 *   components/party/*      background, panels, layouts, widgets */

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { Anton, Inter } from "next/font/google";
import { LayoutGroup, MotionConfig } from "framer-motion";
import { rgba } from "@/lib/albumTheme";
import type { LyricLine } from "@/lib/lyrics";
import { panelClass, textHalo, themeCssVars } from "@/lib/display/theme";
import { DisplayConfigProvider, useDisplayConfig } from "@/hooks/useDisplayConfig";
import { usePartyPlayback } from "@/hooks/usePartyPlayback";
import { useAlbumTheme, useGoveeSync } from "@/hooks/useAlbumTheme";
import { useLyricOffsetKeys } from "@/hooks/useLyricOffsetKeys";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useLyrics } from "@/hooks/useLyrics";
import PartyLyrics from "@/components/PartyLyrics";
import GlassFilterDefs from "@/components/party/GlassFilterDefs";
import DisplayBackground from "@/components/party/DisplayBackground";
import FullscreenButton from "@/components/party/FullscreenButton";
import LyricOffsetToast from "@/components/party/LyricOffsetToast";
import AlbumArt from "@/components/party/AlbumArt";
import NowPlayingCard from "@/components/party/NowPlayingCard";
import Transport from "@/components/party/Transport";
import TitleBlock from "@/components/party/TitleBlock";
import UpNextBar from "@/components/party/UpNextBar";
import ClassicLayout from "@/components/party/layouts/ClassicLayout";
import HeroLayout from "@/components/party/layouts/HeroLayout";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

function activeLineIdx(lines: LyricLine[] | null, positionMs: number) {
  if (!lines) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeMs <= positionMs) idx = i;
    else break;
  }
  return idx;
}

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
  const { config, device, setDevice } = useDisplayConfig();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  const playback = usePartyPlayback(token);
  const { current, upcoming, positionMs } = playback;
  const theme = useAlbumTheme(current?.albumArt);
  useGoveeSync(theme, config.lights.govee.enabled);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  // Lyric timing offset (device.lyricOffsetMs), in ms. Spotify reports the
  // *stream* position, but on a TV / BT speaker / Spotify Connect target the
  // sound you actually hear lags that by the device's output + buffering
  // latency — so the lyrics drift ahead. The -600ms default pulls them back;
  // live-tune with ← / → at the venue.
  const lyricLead = device.lyricOffsetMs;
  const setLyricLead = useCallback((ms: number) => setDevice({ lyricOffsetMs: ms }), [setDevice]);
  const leadToast = useLyricOffsetKeys(lyricLead, setLyricLead);

  const lyrics = useLyrics(current);
  const lyricPos = positionMs + lyricLead;
  const aIdx = activeLineIdx(lyrics.synced, lyricPos);

  // Only time-synced lyrics drive the center column. Plain-only or truly-absent
  // lyrics fall back to the hero layout (big cover + player, enlarged queue).
  // lyrics.mode "always" keeps the lyrics column; "off" always uses the hero.
  const hasSynced = (lyrics.synced?.length ?? 0) > 0;
  const lyricsMode = config.lyrics.mode;
  const showLyrics = lyricsMode === "always" || (lyricsMode === "auto" && (lyrics.loading || hasSynced));
  const upNextCount = config.widgets.upNext.count;
  const maxUpNext = upNextCount === "auto" ? (showLyrics ? 5 : 6) : upNextCount;

  if (status === "loading") {
    return <div className="flex items-center justify-center h-screen bg-white text-black/40 text-sm">Loading…</div>;
  }

  const halo = textHalo(theme);
  const glass = panelClass(config.panels.style);
  const side = <TitleBlock halo={halo} isFullscreen={isFullscreen} />;
  const cover = <AlbumArt track={current} theme={theme} />;

  return (
    <div
      className={`${display.variable} ${sans.variable} relative h-screen w-screen overflow-hidden flex flex-col transition-colors`}
      style={themeCssVars(theme, config)}
    >
      <GlassFilterDefs />
      <DisplayBackground theme={theme} background={config.background} />
      <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
      <LyricOffsetToast visible={leadToast} offsetMs={lyricLead} theme={theme} />

      {/* Top region — lyrics layout (3-col) morphs to/from hero layout (cover +
          one long player bubble). Framer Motion shared-layout (layoutId) slides
          and resizes the cover/now-playing/timeline panels between the two. */}
      <MotionConfig reducedMotion="user">
        <LayoutGroup>
          {showLyrics ? (
            <ClassicLayout
              key="lyrics-layout"
              glass={glass}
              radius={config.panels.radius}
              halo={halo}
              cover={cover}
              nowPlaying={<NowPlayingCard track={current} />}
              transport={<Transport playback={playback} />}
              lyrics={<PartyLyrics lines={lyrics.synced} activeIdx={aIdx} positionMs={lyricPos} plain={lyrics.plain} loading={lyrics.loading} accent={theme.lyric} faint={rgba(theme.ink, 0.28)} />}
              side={side}
            />
          ) : (
            <HeroLayout
              key="hero-layout"
              glass={glass}
              cover={cover}
              nowPlaying={<NowPlayingCard track={current} big />}
              transport={<Transport playback={playback} big />}
              side={side}
            />
          )}
        </LayoutGroup>
      </MotionConfig>

      {/* BOTTOM — up next, floating glass bar */}
      <UpNextBar upcoming={upcoming} max={maxUpNext} roomy={!showLyrics} distort={config.panels.style !== "frosted"} />
    </div>
  );
}
