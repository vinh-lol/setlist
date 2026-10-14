"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { rgba, type AlbumTheme } from "@/lib/albumTheme";
import { useDisplayConfig } from "@/hooks/useDisplayConfig";
import { DEFAULT_CONFIG, DEFAULT_LYRIC_OFFSET_MS, type DisplayConfig } from "@/lib/display/config";
import { ColorTrio, Field, Segmented, Slider, TextInput, Toggle } from "./controls";

type TabId = "color" | "background" | "lyrics" | "panels" | "widgets" | "lights" | "tv";

const TABS: { id: TabId; label: string }[] = [
  { id: "color", label: "Color" },
  { id: "background", label: "Background" },
  { id: "lyrics", label: "Lyrics" },
  { id: "panels", label: "Panels" },
  { id: "widgets", label: "Widgets" },
  { id: "lights", label: "Lights" },
  { id: "tv", label: "This TV" },
];

const secs = (ms: number) => `${ms > 0 ? "+" : ms < 0 ? "−" : ""}${(Math.abs(ms) / 1000).toFixed(1)}s`;

// Slides over the live display so every change previews on the real screen.
// Everything saves as you go; "Reset look" restores the original dashboard.
export default function SettingsDrawer({ open, onClose, theme }: { open: boolean; onClose: () => void; theme: AlbumTheme }) {
  const [tab, setTab] = useState<TabId>("color");
  const { config, setConfig } = useDisplayConfig();

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="settings"
          role="dialog"
          aria-label="Display settings"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-0 right-0 bottom-0 z-40 w-full sm:w-[400px] flex flex-col"
          style={{
            background: rgba(theme.surface, 0.88),
            backdropFilter: "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            borderLeft: `1px solid ${rgba(theme.ink, 0.1)}`,
            color: theme.ink,
            boxShadow: "-24px 0 60px rgba(0,0,0,0.18)",
          }}
        >
          <header className="flex items-center justify-between px-6 pt-6 pb-4">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">Display</h2>
              <p className="text-xs text-[color:var(--ink-50)]">Changes show live and save to this browser. Press S to close.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="p-2 rounded-lg hover:bg-[color:var(--ink-05)] text-[color:var(--ink-65)] hover:text-[color:var(--ink)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <nav className="px-6 pb-4 flex flex-wrap gap-1.5 border-b" style={{ borderColor: "var(--ink-10)" }} aria-label="Settings sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-[0.08em] transition-colors"
                style={{ background: tab === t.id ? "var(--accent)" : "var(--ink-05)", color: tab === t.id ? accentText(theme) : "var(--ink-65)" }}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {tab === "color" && <ColorTab />}
            {tab === "background" && <BackgroundTab />}
            {tab === "lyrics" && <LyricsTab />}
            {tab === "panels" && <PanelsTab />}
            {tab === "widgets" && <WidgetsTab />}
            {tab === "lights" && <LightsTab />}
            {tab === "tv" && <TvTab />}
          </div>

          <footer className="px-6 py-4 border-t flex justify-end" style={{ borderColor: "var(--ink-10)" }}>
            <button
              type="button"
              onClick={() => setConfig(() => DEFAULT_CONFIG)}
              className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--ink-50)] hover:text-[color:var(--ink)]"
            >
              Reset look
            </button>
          </footer>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// Black or white text, whichever reads better on the accent chip.
function accentText(theme: AlbumTheme): string {
  const h = theme.accent.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#FFFFFF";
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

function BackgroundTab() {
  const [bg, set] = useSection("background");
  return (
    <Group>
      <Field label="Background">
        <Segmented label="Background" value={bg.type} onChange={(type) => set({ type })} options={[
          { value: "shader", label: "3D gradient" },
          { value: "soft", label: "Soft gradient" },
          { value: "cover", label: "Blurred cover" },
          { value: "solid", label: "Solid" },
          { value: "image", label: "My image" },
        ]} />
      </Field>
      {bg.type === "image" && (
        <Field label="Image or GIF link" hint="Leave empty to use the blurred cover.">
          <TextInput label="Image link" value={bg.imageUrl} placeholder="https://…" onChange={(imageUrl) => set({ imageUrl })} />
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
          <Field label="Motion">
            <Slider label="Motion speed" value={bg.shader.speed} min={0} max={1} step={0.05} onChange={(speed) => set({ shader: { ...bg.shader, speed } })} format={(v) => (v === 0 ? "Still" : v.toFixed(2))} />
          </Field>
          <Toggle label="Film grain" checked={bg.shader.grain} onChange={(grain) => set({ shader: { ...bg.shader, grain } })} />
        </>
      )}
      {bg.type !== "solid" && (
        <>
          <Field label="Blur">
            <Slider label="Blur" value={bg.blur} min={0} max={40} step={1} onChange={(blur) => set({ blur })} format={(v) => `${v}px`} />
          </Field>
          <Field label="Dim" hint="Tints the background toward the theme surface so text pops.">
            <Slider label="Dim" value={bg.dim} min={0} max={0.8} step={0.02} onChange={(dim) => set({ dim })} format={(v) => `${Math.round(v * 100)}%`} />
          </Field>
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
      <Field label="Panel style" hint="Frosted and solid are much lighter on smart TV browsers.">
        <Segmented label="Panel style" value={panels.style} onChange={(style) => set({ style })} options={[
          { value: "liquid", label: "Liquid glass" },
          { value: "frosted", label: "Frosted" },
          { value: "solid", label: "Solid" },
          { value: "none", label: "None" },
        ]} />
      </Field>
      <Field label="Corners">
        <Slider label="Corner radius" value={panels.radius} min={0} max={48} step={2} onChange={(radius) => set({ radius })} format={(v) => `${v}px`} />
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

function LightsTab() {
  const [lights, set] = useSection("lights");
  const govee = lights.govee;
  return (
    <Group>
      <Toggle
        label="Sync Govee light"
        hint="Needs GOVEE_API_KEY on the server. Does nothing without it."
        checked={govee.enabled}
        onChange={(enabled) => set({ govee: { ...govee, enabled } })}
      >
        <Field label="Light colors">
          <Segmented label="Light colors" value={govee.mode} onChange={(mode) => set({ govee: { ...govee, mode } })} options={[
            { value: "palette", label: "Full palette" },
            { value: "accent", label: "Accent only" },
          ]} />
        </Field>
      </Toggle>
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
      <Toggle label="Low power mode" hint="Swaps the 3D gradient for the soft gradient and liquid glass for frosted. Try this if the TV stutters." checked={device.lowPower} onChange={(lowPower) => setDevice({ lowPower })} />
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
