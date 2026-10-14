"use client";

import type { ReactNode } from "react";

// Small form controls for the settings drawer. They paint with the display's
// own theme variables (--ink, --surface, --accent), so the drawer always
// matches whatever cover is playing and stays legible on it.

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--ink-65)]">{label}</div>
      {children}
      {hint && <p className="text-xs leading-snug text-[color:var(--ink-50)]">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="px-3 py-1.5 rounded-full text-sm border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              borderColor: on ? "var(--ink)" : "var(--ink-15)",
              background: on ? "var(--ink)" : "transparent",
              color: on ? "var(--surface)" : "var(--ink)",
              outlineColor: "var(--accent)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  children?: ReactNode; // extra controls shown only while on
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="w-full flex items-center justify-between gap-4 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 rounded"
        style={{ outlineColor: "var(--accent)" }}
      >
        <span>{label}</span>
        <span
          className="relative shrink-0 w-10 h-6 rounded-full transition-colors"
          style={{ background: checked ? "var(--ink)" : "var(--ink-15)" }}
        >
          <span
            className="absolute top-1 w-4 h-4 rounded-full transition-[left]"
            style={{ left: checked ? 20 : 4, background: checked ? "var(--surface)" : "var(--ink-50)" }}
          />
        </span>
      </button>
      {hint && <p className="text-xs leading-snug text-[color:var(--ink-50)]">{hint}</p>}
      {checked && children && <div className="pl-3 border-l space-y-3" style={{ borderColor: "var(--ink-15)" }}>{children}</div>}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
        style={{ accentColor: "var(--ink)" }}
      />
      <span className="w-14 text-right text-sm tabular-nums">{format(value)}</span>
    </div>
  );
}

export function ColorTrio({ colors, onChange }: { colors: string[]; onChange: (c: string[]) => void }) {
  return (
    <div className="flex gap-2">
      {colors.map((c, i) => (
        <label key={i} className="relative w-12 h-12 rounded-xl overflow-hidden border cursor-pointer" style={{ borderColor: "var(--ink-15)", background: c }}>
          <span className="sr-only">Color {i + 1}</span>
          <input
            type="color"
            value={c}
            onChange={(e) => onChange(colors.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
      ))}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <input
      type="url"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      className="w-full rounded-lg px-3 py-2 text-sm bg-transparent border outline-none focus:border-[color:var(--ink)] placeholder:text-[color:var(--ink-30)]"
      style={{ borderColor: "var(--ink-15)" }}
    />
  );
}
