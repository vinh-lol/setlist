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
import { getQueue, pausePlayback, resumePlayback, skipNext, skipPrevious } from "@/lib/spotify";
import { useCurrentlyPlaying } from "@/hooks/useCurrentlyPlaying";
import { useLyrics } from "@/hooks/useLyrics";
import { analyzeAlbum, buildTheme, rgba, DEFAULT_THEME, type AlbumTheme } from "@/lib/albumTheme";
import { formatDuration } from "@/lib/timeline";
import type { SpotifyTrack } from "@/lib/types";
import type { LyricLine } from "@/lib/lyrics";
import { hexToRgb } from "@/lib/huelix-palette-toolkit";
import PartyLyrics from "@/components/PartyLyrics";
import GlassPanel from "@/components/GlassPanel";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

// WebGL/three — client only.
const GradientBackground = dynamic(() => import("@/components/GradientBackground"), { ssr: false });

interface InfoItem { label: string; time: string; }

const K_DATE = "party-date";
const K_TITLE = "party-title";
const K_INFO = "party-info";
const K_LYRIC_LEAD = "party-lyric-lead";

// Offset applied to lyric timing, in ms. 0 = track the (latency-compensated)
// playback position exactly. Positive = lyrics run ahead of the audio, negative
// = lyrics run behind. Spotify reports the *stream* position, but on a TV / BT
// speaker / Spotify Connect target the sound you actually hear lags that by the
// device's output + buffering latency — so the lyrics drift ahead. A negative
// default pulls them back; live-tune with ← / → at the venue (see below).
const DEFAULT_LYRIC_LEAD_MS = -600;
const LEAD_STEP_MS = 100;

function ls(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch {}
}

// A halo in the tone opposite the ink, so bare text stays legible over the
// live gradient (light glow under dark text, dark glow under light text).
function glowFor(hex: string): string {
  const c = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return lum > 0.5 ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.5)";
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
  const [optimisticPlaying, setOptimisticPlaying] = useState<boolean | null>(null);

  // Editable dashboard copy
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [info, setInfo] = useState<InfoItem[]>([]);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live-tunable lyric timing offset (ms). Persisted so a dialled-in venue
  // setting survives reloads. `leadToast` briefly shows the value while nudging.
  const [lyricLead, setLyricLead] = useState(DEFAULT_LYRIC_LEAD_MS);
  const [leadToast, setLeadToast] = useState(false);
  const leadToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const lead = localStorage.getItem(K_LYRIC_LEAD);
      if (lead !== null && !Number.isNaN(Number(lead))) setLyricLead(Number(lead));
    } catch {
      setInfo([{ label: "", time: "" }]);
    }
  }, []);

  // Live lyric-sync nudge: ← pulls lyrics later (more behind the audio), →
  // pushes them earlier. ↓/0 resets. Lets you dial out TV/speaker output lag at
  // the venue without a redeploy. Ignored while editing a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      let next: number | null = null;
      if (e.key === "ArrowLeft") next = lyricLead - LEAD_STEP_MS;
      else if (e.key === "ArrowRight") next = lyricLead + LEAD_STEP_MS;
      else if (e.key === "ArrowDown" || e.key === "0") next = 0;
      if (next === null) return;
      e.preventDefault();
      setLyricLead(next);
      ls(K_LYRIC_LEAD, String(next));
      setLeadToast(true);
      if (leadToastTimer.current) clearTimeout(leadToastTimer.current);
      leadToastTimer.current = setTimeout(() => setLeadToast(false), 1600);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lyricLead]);

  // Auto-grow the title textarea to fit its wrapped lines. Re-measure after web
  // fonts load (otherwise the height is measured with the fallback font and the
  // taller real font gets clipped) and on resize.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const resize = () => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; };
    resize();
    document.fonts?.ready.then(resize).catch(() => {});
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
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
  const lyricPos = positionMs + lyricLead;
  const aIdx = activeLineIdx(lyrics.synced, lyricPos);

  const pct = current ? Math.min(100, (positionMs / current.duration_ms) * 100) : 0;
  const accentShadow = rgba(theme.accent, 0.4);
  const glow = glowFor(theme.ink);
  const halo = `0 0 8px ${glow}, 0 0 2px ${glow}`;

  // Transport controls (host token); optimistic play/pause flips the icon instantly.
  const playing = optimisticPlaying ?? (nowPlaying?.isPlaying ?? false);
  const handlePrev = () => { if (token) skipPrevious(token).catch(() => {}); };
  const handleNext = () => { if (token) skipNext(token).catch(() => {}); };
  const handlePlayPause = () => {
    if (!token) return;
    const next = !playing;
    setOptimisticPlaying(next);
    (next ? resumePlayback(token) : pausePlayback(token)).catch(() => {});
    setTimeout(() => setOptimisticPlaying(null), 2500);
  };

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
    "--glass-tint": rgba(theme.surface, 0.34),
    "--glass-rim": "rgba(255,255,255,0.22)",
  } as CSSProperties;

  return (
    <div
      className={`${display.variable} ${sans.variable} relative h-screen w-screen overflow-hidden flex flex-col transition-colors duration-700`}
      style={themeVars}
    >
      {/* SVG displacement filter that gives the glass panels their liquid edges */}
      <svg aria-hidden="true" width="0" height="0" className="absolute" style={{ position: "absolute" }}>
        <defs>
          <filter id="lgDistort" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.013" numOctaves="2" seed="14" result="noise" />
            <feGaussianBlur in="noise" stdDeviation="1.4" result="noiseB" />
            <feDisplacementMap in="SourceGraphic" in2="noiseB" scale="34" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Album-coloured moving gradient (sharp WebGL canvas) ... */}
      {theme.gradient.length > 0 && (
        <>
          <div className="absolute inset-0 z-0">
            <GradientBackground colors={theme.gradient} />
          </div>
          {/* ... softened by a backdrop blur layer so it recedes into ambience
              (blurring the canvas via CSS filter would blank it in Chromium). */}
          <div
            className="absolute inset-0 z-0"
            style={{ backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", background: rgba(theme.surface, 0.12) }}
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

      {/* Lyric-sync nudge readout — fades in while adjusting with ← / → (↓ resets) */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full text-xs tracking-[0.18em] uppercase pointer-events-none transition-opacity duration-300"
        style={{
          opacity: leadToast ? 1 : 0,
          background: rgba(theme.ink, 0.08),
          color: rgba(theme.ink, 0.75),
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        Lyrics {lyricLead === 0 ? "in sync" : `${lyricLead > 0 ? "+" : ""}${(lyricLead / 1000).toFixed(1)}s`}
        <span style={{ opacity: 0.5 }}> · ← later · → earlier · ↓ reset</span>
      </div>

      {/* Top region: left info · center lyrics · right cover+QR */}
      <div className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,300px)] gap-8 lg:gap-12 px-8 lg:px-10 pt-9 pb-6">

        {/* LEFT — cover (top) + now-playing pill + transport pill */}
        <section className="hidden lg:flex flex-col min-h-0 gap-5">
          <GlassPanel className="p-5 flex items-center justify-center">
            {current?.albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.albumArt}
                alt={current.albumName}
                className="w-full aspect-square object-cover rounded-xl transition-shadow duration-1000"
                style={{ boxShadow: `0 24px 50px -28px ${accentShadow}, 0 6px 18px -14px ${rgba(theme.ink, 0.22)}` }}
              />
            ) : (
              <div className="w-full aspect-square bg-[color:var(--ink-05)] rounded-xl" />
            )}
          </GlassPanel>

          {/* NOW PLAYING — song info */}
          <GlassPanel className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--ink-40)] mb-2">Now Playing</p>
            <p className="font-bold uppercase tracking-tight text-xl leading-tight line-clamp-2">{current?.name ?? "Nothing playing"}</p>
            <p className="text-sm text-[color:var(--ink-65)] truncate mt-1">{current?.artists.join(", ") ?? "Start a playlist"}</p>
            <p className="text-[11px] text-[color:var(--ink-40)] uppercase tracking-wide truncate mt-0.5">{current?.albumName ?? ""}</p>
          </GlassPanel>

          {/* TRANSPORT — progress + controls */}
          <GlassPanel className="p-5">
            <div className="flex items-center justify-between text-[11px] text-[color:var(--ink-40)] tabular-nums mb-2">
              <span>{formatDuration(Math.min(positionMs, current?.duration_ms ?? 0))}</span>
              <span>{current ? formatDuration(current.duration_ms) : "0:00"}</span>
            </div>
            <div className="h-1 bg-[color:var(--ink-10)] rounded-full overflow-hidden">
              <div className="h-full transition-[width] duration-200 ease-linear" style={{ width: `${pct}%`, background: "var(--accent)" }} />
            </div>
            <div className="flex items-center justify-center gap-8 mt-4">
              <button onClick={handlePrev} title="Previous" className="text-[color:var(--ink-65)] hover:text-[color:var(--ink)] transition-colors">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="2.5" height="14" rx="1" /><path d="M20 5.5v13L9.5 12 20 5.5z" /></svg>
              </button>
              <button onClick={handlePlayPause} title={playing ? "Pause" : "Play"} className="hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
                {playing ? (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.5" height="14" rx="1" /><rect x="14" y="5" width="3.5" height="14" rx="1" /></svg>
                ) : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5.5v13L19 12 7 5.5z" /></svg>
                )}
              </button>
              <button onClick={handleNext} title="Next" className="text-[color:var(--ink-65)] hover:text-[color:var(--ink)] transition-colors">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M4 5.5v13L14.5 12 4 5.5z" /><rect x="16.5" y="5" width="2.5" height="14" rx="1" /></svg>
              </button>
            </div>
          </GlassPanel>
        </section>

        {/* CENTER — lyrics over the gradient (halo for legibility) */}
        <section className="h-full overflow-hidden min-h-[36vh] lg:min-h-0" style={{ textShadow: halo }}>
          <PartyLyrics lines={lyrics.synced} activeIdx={aIdx} positionMs={lyricPos} plain={lyrics.plain} loading={lyrics.loading} accent={theme.accent} faint={rgba(theme.ink, 0.28)} />
        </section>

        {/* RIGHT — editable date + title + info */}
        <section className="flex flex-col min-h-0 gap-5">
          <div>
            <input
              value={date}
              onChange={(e) => saveDate(e.target.value)}
              placeholder="ADD DATE"
              spellCheck={false}
              className={`${editBase} text-xs font-bold uppercase tracking-[0.12em] w-full mb-2 px-2 py-1`}
              style={{ textShadow: halo }}
            />
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => saveTitle(e.target.value)}
              placeholder="PARTY TITLE"
              spellCheck={false}
              rows={1}
              className={`${editBase} font-black uppercase tracking-tight leading-[0.95] break-words text-5xl xl:text-6xl w-full resize-none overflow-hidden px-2 py-2`}
              style={{ fontFamily: "var(--font-sans)", color: "var(--primary)", textShadow: halo }}
            />
            <div className="w-10 border-t mt-5" style={{ borderColor: "var(--accent)" }} />
          </div>

          {/* INFO (editable list) */}
          <GlassPanel className="p-5">
            <div className="text-xs font-bold uppercase tracking-[0.12em] mb-3">Info</div>
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
                    {(!isFullscreen || row.time.trim()) && (
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
        </section>
      </div>

      {/* BOTTOM — up next, floating glass bar */}
      <div className="relative z-10 px-8 lg:px-10 pb-6">
        <GlassPanel className="px-6 py-4 flex items-center gap-8">
          <div className="flex items-center gap-3 shrink-0 text-sm font-bold uppercase tracking-[0.1em]">
            Up Next <span className="text-[color:var(--ink-40)]">→</span>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {upcoming.length === 0 && <p className="text-[color:var(--ink-30)] text-sm uppercase tracking-wide">Queue is empty</p>}
            {upcoming.slice(0, 5).map((track, i) => (
              <div key={track.playId ?? track.id + "-" + i} className="flex gap-3 items-start min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={track.albumArt} alt="" className="w-14 h-14 object-cover rounded-md shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] tabular-nums font-bold" style={{ color: "var(--accent)" }}>{String(i + 1).padStart(2, "0")}</div>
                  <p className="font-bold uppercase tracking-tight text-sm leading-tight truncate">{track.name}</p>
                  <p className="text-[11px] text-[color:var(--ink-50)] uppercase tracking-wide truncate">{track.artists.join(", ")}</p>
                  <p className="text-[11px] text-[color:var(--ink-40)] tabular-nums">{formatDuration(track.duration_ms)}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
