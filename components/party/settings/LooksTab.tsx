"use client";

import { useRef, useState } from "react";
import { usePresets } from "@/hooks/usePresets";
import type { Preset } from "@/lib/display/presets";
import type { DisplayConfig } from "@/lib/display/config";
import { Field } from "./controls";
import { backgroundInfo } from "@/lib/display/backgrounds";


const LYRICS_LABEL: Record<DisplayConfig["lyrics"]["mode"], string> = { auto: "Lyrics", always: "Lyrics always", off: "No lyrics" };

const pill = "px-3 py-1.5 rounded-full text-sm border transition-colors";

// Pick a look, save your own, move looks between screens as files.
export default function LooksTab() {
  const { builtIn, mine, active, changed, apply, saveAsNew, updateActive, revert, remove, rename, exportCurrent, importFile } = usePresets();
  const [naming, setNaming] = useState<null | { id?: string; value: string }>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const status = !active ? "Custom look (not saved)" : changed ? `${active.name}, changed` : `Showing ${active.name}`;

  const submitName = () => {
    if (!naming) return;
    if (naming.id) rename(naming.id, naming.value);
    else saveAsNew(naming.value);
    setNaming(null);
  };

  return (
    <div className="space-y-6">
      {/* Status + save bar */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--ink-05)" }}>
        <p className="text-sm font-bold">{status}</p>
        {naming && !naming.id ? (
          <NameInput value={naming.value} onChange={(value) => setNaming({ value })} onSubmit={submitName} onCancel={() => setNaming(null)} />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={pill} style={solidPill} onClick={() => setNaming({ value: "" })}>Save as new</button>
            {active && !active.builtIn && changed && (
              <button type="button" className={pill} style={outlinePill} onClick={updateActive}>Update {active.name}</button>
            )}
            {active && changed && (
              <button type="button" className={pill} style={outlinePill} onClick={revert}>Revert</button>
            )}
          </div>
        )}
      </div>

      <Field label="Built-in looks">
        <div className="grid grid-cols-2 gap-2">
          {builtIn.map((p) => (
            <LookCard key={p.id} preset={p} active={active?.id === p.id} onApply={() => apply(p)} />
          ))}
        </div>
      </Field>

      <Field label="Your looks" hint={mine.length ? undefined : "Saved looks show up here. They live in this browser; export one to use it on another screen."}>
        {mine.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {mine.map((p) =>
              naming?.id === p.id ? (
                <div key={p.id} className="col-span-2">
                  <NameInput value={naming.value} onChange={(value) => setNaming({ id: p.id, value })} onSubmit={submitName} onCancel={() => setNaming(null)} />
                </div>
              ) : (
                <LookCard key={p.id} preset={p} active={active?.id === p.id} onApply={() => apply(p)}>
                  <div className="flex gap-3 pt-1 text-[11px] uppercase tracking-[0.08em] font-bold">
                    <button type="button" className="text-[color:var(--ink-50)] hover:text-[color:var(--ink)]" onClick={(e) => { e.stopPropagation(); setNaming({ id: p.id, value: p.name }); }}>Rename</button>
                    <button
                      type="button"
                      className="text-[color:var(--ink-50)] hover:text-[color:var(--ink)]"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirmDelete === p.id) { remove(p.id); setConfirmDelete(null); }
                        else setConfirmDelete(p.id);
                      }}
                    >
                      {confirmDelete === p.id ? "Sure?" : "Delete"}
                    </button>
                  </div>
                </LookCard>
              ),
            )}
          </div>
        )}
      </Field>

      <Field label="Move looks between screens" hint="Export saves this look as a file. Import adds a look file to your looks.">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={pill} style={outlinePill} onClick={exportCurrent}>Export this look</button>
          <button type="button" className={pill} style={outlinePill} onClick={() => fileRef.current?.click()}>Import a look</button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try { await importFile(f); setError(""); }
              catch (err) { setError(err instanceof Error ? err.message : "Couldn't read that file."); }
            }}
          />
        </div>
        {error && <p role="alert" className="text-xs font-bold" style={{ color: "var(--accent)" }}>{error}</p>}
      </Field>
    </div>
  );
}

const solidPill = { background: "var(--ink)", color: "var(--surface)", borderColor: "var(--ink)" };
const outlinePill = { borderColor: "var(--ink-15)", color: "var(--ink)" };

function NameInput({ value, onChange, onSubmit, onCancel }: { value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return (
    <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <input
        autoFocus
        aria-label="Look name"
        value={value}
        maxLength={40}
        placeholder="Name this look"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } }}
        className="flex-1 min-w-0 rounded-full px-3 py-1.5 text-sm bg-transparent border outline-none focus:border-[color:var(--ink)] placeholder:text-[color:var(--ink-30)]"
        style={{ borderColor: "var(--ink-15)" }}
      />
      <button type="submit" className={pill} style={solidPill}>Save</button>
      <button type="button" className={pill} style={outlinePill} onClick={onCancel}>Cancel</button>
    </form>
  );
}

// A small picture of the look: its colors (or an "album" stripe), background
// and lyrics setting.
function LookCard({ preset, active, onApply, children }: { preset: Preset; active: boolean; onApply: () => void; children?: React.ReactNode }) {
  const c = preset.config;
  const swatch = c.color.source === "fixed"
    ? `linear-gradient(90deg, ${c.color.fixed.colors.join(", ")})`
    : "linear-gradient(90deg, #FF5F6D, #FFC371, #1CA7A8, #7BE495, #A855F7)";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onApply}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onApply(); } }}
      className="text-left p-3 border cursor-pointer transition-colors hover:bg-[color:var(--ink-05)] focus-visible:outline focus-visible:outline-2"
      style={{
        borderRadius: 14,
        borderColor: active ? "var(--ink)" : "var(--ink-15)",
        boxShadow: active ? "inset 0 0 0 1px var(--ink)" : undefined,
        outlineColor: "var(--accent)",
      }}
    >
      <div className="h-7 rounded-md mb-2" style={{ background: swatch, filter: c.color.mode === "dark" ? "brightness(0.55)" : c.color.intensity === "muted" ? "saturate(0.5)" : undefined }} />
      <p className="text-sm font-bold leading-tight">{preset.name}</p>
      <p className="text-[11px] text-[color:var(--ink-50)] leading-snug mt-0.5">
        {c.color.source === "fixed" ? "Your colors" : "Album colors"} · {backgroundInfo(c.background.type).name} · {LYRICS_LABEL[c.lyrics.mode]}
      </p>
      {children}
    </div>
  );
}
