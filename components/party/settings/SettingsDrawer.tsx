"use client";

import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { rgba, type AlbumTheme } from "@/lib/albumTheme";
import { backgroundInfo } from "@/lib/display/backgrounds";
import { FONT_SIZE_FIX, LYRIC_FONTS, LYRIC_FONT_IDS, loadFonts, lyricFont } from "@/lib/display/fonts";
import BackgroundGallery from "./BackgroundGallery";
import { getMicState, startMic, subscribe as subscribeMic, visualizerSupported, type MicStatus } from "@/lib/display/visualizerAudio";
import { useDisplayConfig } from "@/hooks/useDisplayConfig";
import { DEFAULT_CONFIG, DEFAULT_LYRIC_OFFSET_MS, type DisplayConfig } from "@/lib/display/config";
import { ColorTrio, Field, Segmented, Slider, TextInput, Toggle } from "./controls";

// Looks (presets) and Lights (Govee) are hidden for now; their code is kept
// in LooksTab.tsx / git history. Govee still follows its saved setting.
type TabId = "background" | "color" | "lyrics" | "panels" | "widgets" | "tv";

const TABS: { id: TabId; label: string }[] = [
  { id: "background", label: "Background" },
  { id: "color", label: "Color" },
  { id: "lyrics", label: "Lyrics" },
  { id: "panels", label: "Panels" },
  { id: "widgets", label: "Widgets" },
  { id: "tv", label: "This TV" },
];

const secs = (ms: number) => `${ms > 0 ? "+" : ms < 0 ? "−" : ""}${(Math.abs(ms) / 1000).toFixed(1)}s`;

// Neutral dark palette for the panel, the same every song, so it never
// re-tints and always reads. Overrides the display's theme variables inside.
const PANEL_INK = "#F4F4F6";
const PANEL_BG = "#141418";
const PANEL_VARS = {
  "--ink": PANEL_INK,
  "--surface": PANEL_BG,
  "--accent": PANEL_INK,
  ...Object.fromEntries([65, 50, 40, 35, 30, 25, 15, 10, 5].map((a) => [`--ink-${String(a).padStart(2, "0")}`, rgba(PANEL_INK, a / 100)])),
} as CSSProperties;

const PANEL_W = 380;
const MARGIN = 16;
const K_POS = "display-settings-pos";

type Pos = { x: number; y: number };

const clampPos = (p: Pos, h: number): Pos => ({
  x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - PANEL_W - MARGIN)),
  y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - Math.min(h, 120) - MARGIN)),
});

function loadPos(): Pos {
  try {
    const p = JSON.parse(localStorage.getItem(K_POS) ?? "null");
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return clampPos(p, 400);
  } catch {}
  // Default: top right, just under the corner buttons.
  return { x: window.innerWidth - PANEL_W - 24, y: 64 };
}

// A floating, slightly see-through panel over the display. Drag it by the
// header to move it out of the way of what you're changing; it remembers
// where you left it. The display underneath never resizes or moves.
// Everything saves as you go.
function SettingsDrawer({ open, onClose, theme, albumArt }: { open: boolean; onClose: () => void; theme: AlbumTheme; albumArt?: string }) {
  const [tab, setTab] = useState<TabId>("background");
  const { setConfig, setDevice } = useDisplayConfig();
  const [pos, setPos] = useState<Pos | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (open && !pos) setPos(loadPos());
  }, [open, pos]);

  // Keep it on screen when the window resizes.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampPos(p, panelRef.current?.offsetHeight ?? 400) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button") || !pos) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos(clampPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }, panelRef.current?.offsetHeight ?? 400));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    try { localStorage.setItem(K_POS, JSON.stringify(pos)); } catch {}
  };

  return (
    <AnimatePresence>
      {open && pos && (
        <motion.aside
          ref={panelRef}
          key="settings"
          role="dialog"
          aria-label="Display settings"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed z-40 flex flex-col overflow-hidden rounded-2xl max-w-[calc(100vw-32px)]"
          style={{
            ...PANEL_VARS,
            left: pos.x,
            top: pos.y,
            width: PANEL_W,
            maxHeight: `calc(100vh - ${pos.y + MARGIN}px)`,
            background: "rgba(18,18,22,0.72)",
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter: "blur(18px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            color: PANEL_INK,
          }}
        >
          <header
            className="flex items-center justify-between pl-5 pr-3 pt-4 pb-3 cursor-grab active:cursor-grabbing select-none touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            title="Drag to move"
          >
            <div className="flex items-center gap-2.5">
              <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" className="text-[color:var(--ink-30)]" aria-hidden="true">
                {[2, 7, 12].map((y) => [3, 9].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.4" />))}
              </svg>
              <h2 className="text-base font-black uppercase tracking-tight">Display</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="p-2 rounded-lg hover:bg-[color:var(--ink-05)] text-[color:var(--ink-65)] hover:text-[color:var(--ink)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <nav className="px-5 pb-3 flex flex-wrap gap-1.5 border-b" style={{ borderColor: "var(--ink-10)" }} aria-label="Settings sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-[0.08em] transition-colors"
                style={{ background: tab === t.id ? "var(--ink)" : "var(--ink-05)", color: tab === t.id ? "var(--surface)" : "var(--ink-65)" }}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
            {tab === "color" && <ColorTab />}
            {tab === "background" && <BackgroundTab theme={theme} albumArt={albumArt} />}
            {tab === "lyrics" && <LyricsTab />}
            {tab === "panels" && <PanelsTab />}
            {tab === "widgets" && <WidgetsTab />}
            {tab === "tv" && <TvTab />}
          </div>

          <footer className="px-5 py-3 border-t flex justify-end" style={{ borderColor: "var(--ink-10)" }}>
            <button
              type="button"
              onClick={() => { setConfig(() => DEFAULT_CONFIG); setDevice({ activePresetId: "classic" }); }}
              className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--ink-50)] hover:text-[color:var(--ink)]"
            >
              Reset all
            </button>
          </footer>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// Patch one section of the config, keeping the rest.
function useSection<K extends keyof DisplayConfig>(key: K) {
  const { config, setConfig } = useDisplayConfig();
  const value = config[key];
  const set = (patch: Partial<DisplayConfig[K]>) => setConfig((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } }));
  return [value, set] as const;
}

function Group({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

function ColorTab() {
  const [color, set] = useSection("color");
  return (
    <Group>
      <Field label="Colors from">
        <Segmented label="Colors from" value={color.source} onChange={(source) => set({ source })} options={[
          { value: "album", label: "Album cover" },
          { value: "fixed", label: "My colors" },
        ]} />
      </Field>
      {color.source === "fixed" && (
        <Field label="Your three colors" hint="Built into a full theme the same way a cover would be.">
          <ColorTrio colors={color.fixed.colors} onChange={(colors) => set({ fixed: { colors } })} />
        </Field>
      )}
      <Field label="Light or dark" hint="Auto follows the cover. Dark suits a dim room.">
        <Segmented label="Light or dark" value={color.mode} onChange={(mode) => set({ mode })} options={[
          { value: "auto", label: "Auto" },
          { value: "dark", label: "Dark" },
          { value: "light", label: "Light" },
        ]} />
      </Field>
      <Field label="Intensity">
        <Segmented label="Intensity" value={color.intensity} onChange={(intensity) => set({ intensity })} options={[
          { value: "muted", label: "Muted" },
          { value: "balanced", label: "Balanced" },
          { value: "vivid", label: "Vivid" },
        ]} />
      </Field>
      <Field label="Song change fade">
        <Segmented label="Song change fade" value={color.transitionMs} onChange={(transitionMs) => set({ transitionMs })} options={[
          { value: 0, label: "Instant" },
          { value: 700, label: "Smooth" },
          { value: 3000, label: "Slow" },
        ]} />
      </Field>
    </Group>
  );
}

function BackgroundTab({ theme, albumArt }: { theme: AlbumTheme; albumArt?: string }) {
  const [bg, set] = useSection("background");
  const info = backgroundInfo(bg.type);
  return (
    <Group>
      {/* Motion stays pinned to the top while the gallery scrolls under it. */}
      <div
        className="sticky top-0 z-10 -mt-4 -mx-5 px-5 pt-4 pb-3 border-b"
        style={{ background: "rgba(18,18,22,0.6)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderColor: "var(--ink-10)" }}
      >
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--ink-65)]">Motion</span>
          {!info.speed && <span className="text-[11px] text-[color:var(--ink-50)]">{info.name} doesn&apos;t move</span>}
        </div>
        <Slider label="Motion speed" disabled={!info.speed} value={bg.speed} min={0} max={2} step={0.1} onChange={(speed) => set({ speed })} format={(v) => (v === 0 ? "Paused" : `${v.toFixed(1)}x`)} />
      </div>
      {bg.type === "image" && (
        <Field label="Image or GIF link" hint="Leave empty to use the blurred cover.">
          <TextInput label="Image link" value={bg.imageUrl} placeholder="https://…" onChange={(imageUrl) => set({ imageUrl })} />
        </Field>
      )}
      {bg.type === "billboard" && (
        <Field label="Billboard shows">
          <Segmented label="Billboard shows" value={bg.billboard} onChange={(billboard) => set({ billboard })} options={[
            { value: "cover", label: "Cover and song" },
            { value: "lyrics", label: "Lyric line" },
          ]} />
        </Field>
      )}
      {bg.type === "visualizer" && <VisualizerOptions />}
      {bg.type === "shader" && (
        <>
          <Field label="Shape">
            <Segmented label="Shape" value={bg.shader.shape} onChange={(shape) => set({ shader: { ...bg.shader, shape } })} options={[
              { value: "waterPlane", label: "Water" },
              { value: "plane", label: "Plane" },
              { value: "sphere", label: "Sphere" },
            ]} />
          </Field>
          <Toggle label="Film grain" checked={bg.shader.grain} onChange={(grain) => set({ shader: { ...bg.shader, grain } })} />
        </>
      )}
      <BackgroundGallery value={bg.type} onChange={(type) => set({ type })} theme={theme} albumArt={albumArt} />
    </Group>
  );
}

const MIC_TEXT: Record<MicStatus, string> = {
  off: "Not listening yet.",
  asking: "Waiting for permission…",
  listening: "Listening to the room.",
  denied: "Microphone blocked. Allow it in the browser's site settings, or use the built-in beat.",
  insecure: "The microphone only works on a secure (https) link. Using the built-in beat for now.",
  unsupported: "This browser has no microphone access. Using the built-in beat.",
};
const OFF_SERVER = { status: "off" as MicStatus, node: null };

function VisualizerOptions() {
  const [bg, set] = useSection("background");
  const v = bg.visualizer;
  const mic = useSyncExternalStore(subscribeMic, getMicState, () => OFF_SERVER);
  const supported = useMemo(() => visualizerSupported(), []);
  if (!supported) {
    return <p className="text-sm text-[color:var(--ink-65)]">This screen&apos;s browser can&apos;t run the visualizer (it needs WebGL2).</p>;
  }
  return (
    <>
      <Field label="Reacts to" hint="Spotify doesn't share the audio itself, so the visualizer listens to the room.">
        <Segmented label="Reacts to" value={v.source} onChange={(source) => set({ visualizer: { ...v, source } })} options={[
          { value: "mic", label: "Microphone" },
          { value: "beat", label: "Built-in beat" },
        ]} />
      </Field>
      {v.source === "mic" && (
        <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--ink-05)" }}>
          <p className="text-xs leading-snug text-[color:var(--ink-65)]">{MIC_TEXT[mic.status]}</p>
          {(mic.status === "off" || mic.status === "denied") && (
            <button type="button" onClick={() => startMic()} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: "var(--ink)", color: "var(--surface)" }}>
              Allow mic
            </button>
          )}
        </div>
      )}
      <Field label="New look" hint="Press V on the display for another look.">
        <Segmented label="New look" value={v.change} onChange={(change) => set({ visualizer: { ...v, change } })} options={[
          { value: "song", label: "Each song" },
          { value: "minute", label: "Every minute" },
          { value: "never", label: "Never" },
        ]} />
      </Field>
      <Toggle label="Use cover colors" hint="Recolors the visualizer with the album's colors." checked={v.tint} onChange={(tint) => set({ visualizer: { ...v, tint } })} />
    </>
  );
}

function LyricsTab() {
  const [lyrics, set] = useSection("lyrics");
  // Load every lyric font while this tab is open so the previews show in their own type.
  useEffect(() => loadFonts(LYRIC_FONT_IDS), []);
  return (
    <Group>
      <Field label="Show lyrics" hint="Auto switches to the big player when a song has no synced lyrics.">
        <Segmented label="Show lyrics" value={lyrics.mode} onChange={(mode) => set({ mode })} options={[
          { value: "auto", label: "Auto" },
          { value: "always", label: "Always" },
          { value: "off", label: "Off" },
        ]} />
      </Field>
      <Field label="Font">
        <div role="radiogroup" aria-label="Lyric font" className="grid grid-cols-3 gap-1.5">
          {LYRIC_FONTS.map((f) => {
            const on = f.id === lyrics.font;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={f.name}
                onClick={() => set({ font: f.id })}
                className="rounded-lg px-2 pt-2 pb-1.5 border text-left transition-colors hover:bg-[color:var(--ink-05)]"
                style={{ borderColor: on ? "var(--ink)" : "var(--ink-10)", boxShadow: on ? "inset 0 0 0 1px var(--ink)" : undefined }}
              >
                <span className="block truncate leading-none" style={{ fontFamily: f.family, fontSize: `${22 * (FONT_SIZE_FIX[f.id] ?? 1)}px`, height: 26 }}>
                  {lyrics.caps ? "SING" : "Sing"}
                </span>
                <span className="block mt-1 text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-50)]">{f.name}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Layout">
        <Segmented label="Layout" value={lyrics.layout} onChange={(layout) => set({ layout })} options={[
          { value: "scroll", label: "Scrolling" },
          { value: "focus", label: "One line" },
        ]} />
      </Field>
      <Field label="Reveal">
        <Segmented label="Reveal" value={lyrics.reveal} onChange={(reveal) => set({ reveal })} options={[
          { value: "word", label: "Word" },
          { value: "sweep", label: "Karaoke" },
          { value: "line", label: "Line" },
        ]} />
      </Field>
      <Field label="Effect">
        <Segmented label="Effect" value={lyrics.effect} onChange={(effect) => set({ effect })} options={[
          { value: "none", label: "None" },
          { value: "glow", label: "Glow" },
          { value: "outline", label: "Outline" },
          { value: "pop", label: "Pop" },
        ]} />
      </Field>
      <Field label="Size">
        <Segmented label="Size" value={lyrics.size} onChange={(size) => set({ size })} options={[
          { value: "s", label: "Small" },
          { value: "m", label: "Medium" },
          { value: "l", label: "Large" },
        ]} />
      </Field>
      <Field label="Align">
        <Segmented label="Align" value={lyrics.align} onChange={(align) => set({ align })} options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
        ]} />
      </Field>
      <Toggle label="All caps" checked={lyrics.caps} onChange={(caps) => set({ caps })} />
    </Group>
  );
}

function PanelsTab() {
  const [panels, set] = useSection("panels");
  return (
    <Group>
      <Field label="Panel style" hint="Solid is much lighter than glass on smart TV browsers.">
        <Segmented label="Panel style" value={panels.style} onChange={(style) => set({ style })} options={[
          { value: "glass", label: "Glass" },
          { value: "solid", label: "Solid" },
          { value: "none", label: "None" },
        ]} />
      </Field>
    </Group>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--ink-50)] border-b pb-1.5" style={{ borderColor: "var(--ink-10)" }}>{title}</h3>
      {children}
    </section>
  );
}

function WidgetsTab() {
  const [w, set] = useSection("widgets");
  const fontOptions = LYRIC_FONTS.map((f) => ({ value: f.id, label: f.name }));
  return (
    <div className="space-y-7">
      <Section title="Right side">
        <Toggle label="Show the right side" hint="Off gives the lyrics the full width." checked={w.side} onChange={(side) => set({ side })} />
        {w.side && (
          <>
            <Toggle label="Clock" checked={w.clock.show} onChange={(show) => set({ clock: { ...w.clock, show } })}>
              <Toggle label="12-hour" checked={w.clock.hour12} onChange={(hour12) => set({ clock: { ...w.clock, hour12 } })} />
              <Toggle label="Seconds" checked={w.clock.seconds} onChange={(seconds) => set({ clock: { ...w.clock, seconds } })} />
            </Toggle>
            <Toggle label="Date" checked={w.clock.date} onChange={(date) => set({ clock: { ...w.clock, date } })} />
            <Toggle label="Party title" checked={w.title.show} onChange={(show) => set({ title: { ...w.title, show } })}>
              <Field label="Title font">
                <select
                  aria-label="Title font"
                  value={w.title.font}
                  onChange={(e) => set({ title: { ...w.title, font: e.target.value as typeof w.title.font } })}
                  className="w-full rounded-lg px-3 py-2 text-sm border bg-transparent"
                  style={{ borderColor: "var(--ink-15)", color: "var(--ink)", fontFamily: lyricFont(w.title.font).family }}
                >
                  {fontOptions.map((o) => <option key={o.value} value={o.value} style={{ color: "#111" }}>{o.label}</option>)}
                </select>
              </Field>
              <Toggle label="Accent line under the title" checked={w.title.divider} onChange={(divider) => set({ title: { ...w.title, divider } })} />
            </Toggle>
            <Toggle label="Info list" checked={w.info} onChange={(info) => set({ info })}>
              <Toggle label="“Info” heading" checked={w.infoHeading} onChange={(infoHeading) => set({ infoHeading })} />
              <Toggle label="Times" checked={w.infoTimes} onChange={(infoTimes) => set({ infoTimes })} />
            </Toggle>
          </>
        )}
      </Section>
      <Section title="Main">
        <Toggle label="Now playing" checked={w.nowPlaying} onChange={(nowPlaying) => set({ nowPlaying })} />
        <Toggle label="Playback controls" hint="Hide on a TV nobody will click." checked={w.transport} onChange={(transport) => set({ transport })} />
      </Section>
      <Section title="Bottom">
        <Toggle label="Up next" checked={w.upNext.show} onChange={(show) => set({ upNext: { ...w.upNext, show } })}>
          <Field label="Songs shown">
            <Segmented label="Songs shown" value={w.upNext.count} onChange={(count) => set({ upNext: { ...w.upNext, count } })} options={[
              { value: "auto", label: "Auto" },
              ...[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })),
            ]} />
          </Field>
        </Toggle>
      </Section>
    </div>
  );
}

function TvTab() {
  const { device, setDevice } = useDisplayConfig();
  return (
    <Group>
      <p className="text-xs leading-snug text-[color:var(--ink-50)]">These stay with this screen and aren&apos;t part of the look.</p>
      <Field label="Lyric timing" hint="Pull lyrics later if they run ahead of the speakers. Arrow keys work too.">
        <Slider label="Lyric timing" value={device.lyricOffsetMs} min={-3000} max={1500} step={100} onChange={(lyricOffsetMs) => setDevice({ lyricOffsetMs })} format={secs} />
        {device.lyricOffsetMs !== DEFAULT_LYRIC_OFFSET_MS && (
          <button type="button" onClick={() => setDevice({ lyricOffsetMs: DEFAULT_LYRIC_OFFSET_MS })} className="text-xs underline text-[color:var(--ink-50)] hover:text-[color:var(--ink)]">
            Back to default ({secs(DEFAULT_LYRIC_OFFSET_MS)})
          </button>
        )}
      </Field>
      <Toggle label="Keep screen awake" hint="Stops the TV or laptop from sleeping mid-party." checked={device.keepAwake} onChange={(keepAwake) => setDevice({ keepAwake })} />
      <Toggle label="Low power mode" hint="Swaps the 3D gradient for the soft gradient and glass for solid panels. Try this if the TV stutters." checked={device.lowPower} onChange={(lowPower) => setDevice({ lowPower })} />
      <Field label="Keyboard">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {[
            ["S", "Settings"],
            ["F", "Fullscreen"],
            ["← →", "Lyric timing"],
            ["↓ or 0", "Reset lyric timing"],
            ["Esc", "Close settings"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <dt><kbd className="px-1.5 py-0.5 rounded border text-xs font-bold" style={{ borderColor: "var(--ink-15)" }}>{k}</kbd></dt>
              <dd className="text-[color:var(--ink-65)]">{v}</dd>
            </div>
          ))}
        </dl>
      </Field>
    </Group>
  );
}

export default memo(SettingsDrawer);
