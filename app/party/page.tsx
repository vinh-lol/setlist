"use client";

/* Hallmark · macrostructure: Editorial Dashboard (studied DNA) · genre: editorial
 * tone: editorial · color: album-adaptive via Huelix toolkit (Surface/Body/Primary/Accent roles)
 * type: Anton (title) + Inter (UI) + Bitcount Single (lyrics)
 * lyrics: word-by-word build · /party fullscreen dashboard */

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Anton, Inter } from "next/font/google";
import dynamic from "next/dynamic";
import QRCode from "react-qr-code";
import { getQueue, addToQueue } from "@/lib/spotify";
import { useCurrentlyPlaying } from "@/hooks/useCurrentlyPlaying";
import { useLyrics } from "@/hooks/useLyrics";
import { analyzeAlbum, buildTheme, rgba, DEFAULT_THEME, type AlbumTheme } from "@/lib/albumTheme";
import { formatDuration } from "@/lib/timeline";
import type { SpotifyTrack } from "@/lib/types";
import type { LyricLine } from "@/lib/lyrics";
import PartyLyrics from "@/components/PartyLyrics";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

// WebGL/three — client only.
const GradientBackground = dynamic(() => import("@/components/GradientBackground"), { ssr: false });

interface InfoItem { label: string; time: string; }

const K_DATE = "party-date";
const K_TITLE = "party-title";
const K_INFO = "party-info";

// Nudge lyrics slightly ahead of the audio — reading lags, so a small lead reads
// as "in sync." Tune here if it feels early/late.
const LYRIC_LEAD_MS = 220;

function ls(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch {}
}

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = session?.accessToken ?? "";

  const [queue, setQueue] = useState<SpotifyTrack[]>([]);
  const [positionMs, setPositionMs] = useState(0);
  const [theme, setTheme] = useState<AlbumTheme>(DEFAULT_THEME);
  const [partyCode, setPartyCode] = useState("");
  const [requestUrl, setRequestUrl] = useState("");

  // Editable dashboard copy
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [info, setInfo] = useState<InfoItem[]>([]);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const nowPlaying = useCurrentlyPlaying(token);
  const anchorRef = useRef<{ at: number; progress: number; playing: boolean } | null>(null);
  if (nowPlaying) anchorRef.current = { at: nowPlaying.fetchedAt, progress: nowPlaying.progressMs, playing: nowPlaying.isPlaying };

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // Load editable copy
  useEffect(() => {
    try {
      setDate(localStorage.getItem(K_DATE) ?? "");
      setTitle(localStorage.getItem(K_TITLE) ?? localStorage.getItem("party-custom-text") ?? "");
      const raw = localStorage.getItem(K_INFO);
      setInfo(raw ? JSON.parse(raw) : [{ label: "", time: "" }]);
    } catch {
      setInfo([{ label: "", time: "" }]);
    }
  }, []);

  // Auto-grow the title textarea to fit its wrapped lines.
  useEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [title]);

  const saveDate = (v: string) => { setDate(v); ls(K_DATE, v); };
  const saveTitle = (v: string) => { setTitle(v); ls(K_TITLE, v); };
  const saveInfo = (next: InfoItem[]) => { setInfo(next); ls(K_INFO, JSON.stringify(next)); };
  const updateInfo = (i: number, field: keyof InfoItem, v: string) =>
    saveInfo(info.map((row, j) => (j === i ? { ...row, [field]: v } : row)));
  const addInfo = () => saveInfo([...info, { label: "", time: "" }]);
  const removeInfo = (i: number) => saveInfo(info.filter((_, j) => j !== i));

  // Live Spotify queue
  useEffect(() => {
    if (!token) return;
    let active = true;
    const poll = async () => {
      try { const q = await getQueue(token); if (active) setQueue(q); } catch {}
    };
    poll();
    const id = setInterval(poll, 3_000);
    return () => { active = false; clearInterval(id); };
  }, [token]);

  // Stable party code for the guest "add a song" QR link.
  useEffect(() => {
    try {
      let c = localStorage.getItem("party-code");
      if (!c) { c = Math.random().toString(36).slice(2, 8).toUpperCase(); localStorage.setItem("party-code", c); }
      setPartyCode(c);
      setRequestUrl(`${window.location.origin}/request?p=${c}`);
    } catch {}
  }, []);

  // Drain guest requests and add them to Spotify from the host browser.
  useEffect(() => {
    if (!token || !partyCode) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/party/${partyCode}`);
        if (!res.ok) return;
        const { requests } = await res.json();
        for (const r of requests ?? []) {
          if (!active) break;
          await addToQueue(token, r.id);
        }
      } catch {}
    };
    const id = setInterval(poll, 3_000);
    return () => { active = false; clearInterval(id); };
  }, [token, partyCode]);

  // Smooth playback clock
  useEffect(() => {
    const tick = () => {
      const a = anchorRef.current;
      if (a) setPositionMs(a.playing ? a.progress + (Date.now() - a.at) : a.progress);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, []);

  // Current track comes straight from currently-playing (follows any device, no
  // queue lag); the queue only feeds "up next".
  const qIdx = nowPlaying?.trackId ? queue.findIndex((t) => t.id === nowPlaying.trackId) : -1;
  const current: SpotifyTrack | null = nowPlaying?.track ?? queue[Math.max(0, qIdx)] ?? null;
  const upcoming = queue.slice((qIdx >= 0 ? qIdx : 0) + 1);

  // Adapt the whole theme to the album cover via the Huelix toolkit.
  useEffect(() => {
    if (!current?.albumArt) { setTheme(DEFAULT_THEME); return; }
    let active = true;
    analyzeAlbum(current.albumArt)
      .then(({ palette, candidates }) => { if (active) setTheme(buildTheme(palette, candidates)); })
      .catch(() => { if (active) setTheme(DEFAULT_THEME); });
    return () => { active = false; };
  }, [current?.albumArt]);

  const lyrics = useLyrics(current);
  const lyricPos = positionMs + LYRIC_LEAD_MS;
  const aIdx = activeLineIdx(lyrics.synced, lyricPos);

  const pct = current ? Math.min(100, (positionMs / current.duration_ms) * 100) : 0;
  const accentShadow = rgba(theme.accent, 0.4);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  if (status === "loading") {
    return <div className="flex items-center justify-center h-screen bg-white text-black/40 text-sm">Loading…</div>;
  }

  const editBase =
    "bg-transparent outline-none focus:bg-[color:var(--ink-05)] rounded transition-colors placeholder:text-[color:var(--ink-25)]";

  const themeVars = {
    background: theme.surface,
    color: theme.ink,
    fontFamily: "var(--font-sans)",
    "--ink": theme.ink,
    "--accent": theme.accent,
    "--primary": theme.primary,
    "--ink-65": rgba(theme.ink, 0.65),
    "--ink-50": rgba(theme.ink, 0.5),
    "--ink-40": rgba(theme.ink, 0.4),
    "--ink-35": rgba(theme.ink, 0.35),
    "--ink-30": rgba(theme.ink, 0.3),
    "--ink-25": rgba(theme.ink, 0.25),
    "--ink-15": rgba(theme.ink, 0.15),
    "--ink-10": rgba(theme.ink, 0.1),
    "--ink-05": rgba(theme.ink, 0.05),
  } as CSSProperties;

  return (
    <div
      className={`${display.variable} ${sans.variable} relative h-screen w-screen overflow-hidden flex flex-col transition-colors duration-700`}
      style={themeVars}
    >
      {/* Album-coloured moving gradient + frosted scrim for legibility */}
      {theme.gradient.length > 0 && (
        <>
          <div className="absolute inset-0 z-0">
            <GradientBackground colors={theme.gradient} />
          </div>
          <div
            className="absolute inset-0 z-0"
            style={{ background: rgba(theme.surface, 0.32), backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
          />
        </>
      )}

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        className="absolute top-4 right-4 z-30 p-2 rounded-lg text-[color:var(--ink-30)] hover:text-[color:var(--ink)] hover:bg-[color:var(--ink-05)] transition-colors"
      >
        {isFullscreen ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>
        )}
      </button>

      {/* Top region: left info · center lyrics · right cover+QR */}
      <div className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,300px)] gap-8 lg:gap-12 px-8 lg:px-10 pt-9 pb-6">

        {/* LEFT — editable header + info + now playing */}
        <section className="flex flex-col min-h-0">
          <input
            value={date}
            onChange={(e) => saveDate(e.target.value)}
            placeholder="ADD DATE"
            spellCheck={false}
            className={`${editBase} text-xs font-bold uppercase tracking-[0.12em] w-full mb-3`}
          />
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => saveTitle(e.target.value)}
            placeholder="PARTY TITLE"
            spellCheck={false}
            rows={1}
            className={`${editBase} uppercase tracking-tight leading-[0.9] text-5xl xl:text-6xl w-full resize-none overflow-hidden`}
            style={{ fontFamily: "var(--font-display)", color: "var(--primary)" }}
          />

          <div className="w-10 border-t my-6" style={{ borderColor: "var(--accent)" }} />

          {/* INFO (editable list) */}
          <div className="text-xs font-bold uppercase tracking-[0.12em] mb-3">Info</div>
          <div className="space-y-1.5">
            {info.map((row, i) => (
              <div key={i} className="group flex items-center gap-2">
                <input
                  value={row.label}
                  onChange={(e) => updateInfo(i, "label", e.target.value)}
                  placeholder="ITEM"
                  spellCheck={false}
                  className={`${editBase} flex-1 min-w-0 text-sm uppercase tracking-wide`}
                />
                <input
                  value={row.time}
                  onChange={(e) => updateInfo(i, "time", e.target.value)}
                  placeholder="TIME"
                  spellCheck={false}
                  className={`${editBase} w-16 text-sm text-right tabular-nums`}
                />
                <button
                  onClick={() => removeInfo(i)}
                  className="opacity-0 group-hover:opacity-100 text-[color:var(--ink-30)] hover:text-[color:var(--ink)] text-xs w-4 shrink-0 transition-opacity"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
            <button onClick={addInfo} className="text-xs uppercase tracking-wide text-[color:var(--ink-35)] hover:text-[color:var(--ink)] transition-colors pt-1">
              + Add item
            </button>
          </div>

          {/* NOW PLAYING — pinned to bottom of the left column */}
          <div className="mt-auto pt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--ink-40)] mb-2">Now Playing</p>
            <p className="font-bold uppercase tracking-tight text-xl leading-tight line-clamp-2">{current?.name ?? "Nothing playing"}</p>
            <p className="text-sm text-[color:var(--ink-65)] truncate mt-1">{current?.artists.join(", ") ?? "Start a playlist"}</p>
            <p className="text-[11px] text-[color:var(--ink-40)] uppercase tracking-wide truncate mt-0.5">{current?.albumName ?? ""}</p>
            <p className="text-sm text-[color:var(--ink-65)] tabular-nums mt-3">
              {formatDuration(Math.min(positionMs, current?.duration_ms ?? 0))}
              <span className="text-[color:var(--ink-30)]"> / {current ? formatDuration(current.duration_ms) : "0:00"}</span>
            </p>
            <div className="mt-3 h-1 bg-[color:var(--ink-10)] rounded-full overflow-hidden">
              <div className="h-full transition-[width] duration-200 ease-linear" style={{ width: `${pct}%`, background: "var(--accent)" }} />
            </div>
          </div>
        </section>

        {/* CENTER — lyrics, clipped to this column */}
        <section className="h-full overflow-hidden min-h-[36vh] lg:min-h-0">
          <PartyLyrics lines={lyrics.synced} activeIdx={aIdx} positionMs={lyricPos} plain={lyrics.plain} loading={lyrics.loading} accent={theme.accent} faint={rgba(theme.ink, 0.28)} />
        </section>

        {/* RIGHT — big album cover + guest "add a song" QR, centered as a group */}
        <section className="hidden lg:flex flex-col items-center justify-center gap-5 min-h-0">
          {current?.albumArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.albumArt}
              alt={current.albumName}
              className="w-full aspect-square object-cover rounded-md transition-shadow duration-1000"
              style={{ boxShadow: `0 32px 64px -30px ${accentShadow}, 0 8px 24px -16px ${rgba(theme.ink, 0.22)}` }}
            />
          ) : (
            <div className="w-full aspect-square bg-[color:var(--ink-05)] rounded-md" />
          )}
          {requestUrl && (
            <div className="flex items-center justify-center gap-4">
              <QRCode value={requestUrl} size={64} bgColor="transparent" fgColor={theme.ink} />
              <div>
                <p className="text-sm font-bold uppercase tracking-tight leading-tight">Scan to<br />add a song</p>
                <p className="text-[11px] text-[color:var(--ink-40)] tracking-[0.2em] mt-1">{partyCode}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* BOTTOM — up next ticker */}
      <div className="relative z-10 border-t border-[color:var(--ink-15)] px-8 lg:px-10 py-5 flex items-center gap-8">
        <div className="flex items-center gap-3 shrink-0 text-sm font-bold uppercase tracking-[0.1em]">
          Up Next <span className="text-[color:var(--ink-40)]">→</span>
        </div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {upcoming.length === 0 && <p className="text-[color:var(--ink-30)] text-sm uppercase tracking-wide">Queue is empty</p>}
          {upcoming.slice(0, 5).map((track, i) => (
            <div key={track.playId ?? track.id + "-" + i} className="flex gap-3 items-start min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={track.albumArt} alt="" className="w-14 h-14 object-cover rounded-sm shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] tabular-nums font-bold" style={{ color: "var(--accent)" }}>{String(i + 1).padStart(2, "0")}</div>
                <p className="font-bold uppercase tracking-tight text-sm leading-tight truncate">{track.name}</p>
                <p className="text-[11px] text-[color:var(--ink-50)] uppercase tracking-wide truncate">{track.artists.join(", ")}</p>
                <p className="text-[11px] text-[color:var(--ink-40)] tabular-nums">{formatDuration(track.duration_ms)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
