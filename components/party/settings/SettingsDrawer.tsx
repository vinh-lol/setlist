"use client";

import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { rgba, type AlbumTheme } from "@/lib/albumTheme";
import { backgroundInfo } from "@/lib/display/backgrounds";
import BackgroundGallery from "./BackgroundGallery";
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
      <BackgroundGallery value={bg.type} onChange={(type) => set({ type })} theme={theme} albumArt={albumArt} />
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
      {info.speed && (
        <Field label="Motion">
          <Slider label="Motion speed" value={bg.speed} min={0} max={2} step={0.1} onChange={(speed) => set({ speed })} format={(v) => (v === 0 ? "Paused" : `${v.toFixed(1)}x`)} />
        </Field>
      )}
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
    </Group>
  );
}

function LyricsTab() {
  const [lyrics, set] = useSection("lyrics");
  return (
    <Group>
      <Field label="Show lyrics" hint="Auto switches to the big player when a song has no synced lyrics.">
        <Segmented label="Show lyrics" value={lyrics.mode} onChange={(mode) => set({ mode })} options={[
          { value: "auto", label: "Auto" },
          { value: "always", label: "Always" },
          { value: "off", label: "Off" },
        ]} />
      </Field>
      <Field label="Reveal">
        <Segmented label="Reveal" value={lyrics.reveal} onChange={(reveal) => set({ reveal })} options={[
          { value: "word", label: "Word by word" },
          { value: "line", label: "Whole line" },
        ]} />
      </Field>
      <Field label="Font">
        <Segmented label="Font" value={lyrics.font} onChange={(font) => set({ font })} options={[
          { value: "bitcount", label: "Pixel" },
          { value: "anton", label: "Condensed" },
          { value: "inter", label: "Clean" },
        ]} />
      </Field>
      <Field label="Size">
        <Segmented label="Size" value={lyrics.size} onChange={(size) => set({ size })} options={[
          { value: "s", label: "Small" },
          { value: "m", label: "Medium" },
          { value: "l", label: "Large" },
        ]} />
      </Field>
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

function WidgetsTab() {
  const [w, set] = useSection("widgets");
  return (
    <Group>
      <Toggle label="Now playing" checked={w.nowPlaying} onChange={(nowPlaying) => set({ nowPlaying })} />
      <Toggle label="Playback controls" hint="Hide on a TV nobody will click." checked={w.transport} onChange={(transport) => set({ transport })} />
      <Toggle label="Up next" checked={w.upNext.show} onChange={(show) => set({ upNext: { ...w.upNext, show } })}>
        <Field label="Songs shown">
          <Segmented label="Songs shown" value={w.upNext.count} onChange={(count) => set({ upNext: { ...w.upNext, count } })} options={[
            { value: "auto", label: "Auto" },
            ...[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) })),
          ]} />
        </Field>
      </Toggle>
      <Toggle label="Clock" checked={w.clock.show} onChange={(show) => set({ clock: { ...w.clock, show } })}>
        <Toggle label="12-hour" checked={w.clock.hour12} onChange={(hour12) => set({ clock: { ...w.clock, hour12 } })} />
        <Toggle label="Seconds" checked={w.clock.seconds} onChange={(seconds) => set({ clock: { ...w.clock, seconds } })} />
      </Toggle>
      <Toggle label="Date" checked={w.clock.date} onChange={(date) => set({ clock: { ...w.clock, date } })} />
      <Toggle label="Party title" checked={w.title.show} onChange={(show) => set({ title: { ...w.title, show } })}>
        <Field label="Title font">
          <Segmented label="Title font" value={w.title.font} onChange={(font) => set({ title: { ...w.title, font } })} options={[
            { value: "inter", label: "Clean" },
            { value: "anton", label: "Condensed" },
          ]} />
        </Field>
      </Toggle>
      <Toggle label="Info list" checked={w.info} onChange={(info) => set({ info })} />
    </Group>
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
