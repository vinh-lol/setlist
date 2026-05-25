"use client";

import { useState } from "react";

interface Props {
  defaultName: string;
  partyStart: Date;
  onSave: (name: string, partyStart: Date) => Promise<void>;
  onClose: () => void;
}

export default function SaveSetlistModal({ defaultName, partyStart, onSave, onClose }: Props) {
  const [name, setName] = useState(defaultName);
  const [timeStr, setTimeStr] = useState(
    partyStart.toTimeString().slice(0, 5) // "HH:MM"
  );
  const [saving, setSaving] = useState(false);

  function buildDate(): Date {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date(partyStart);
    d.setHours(h, m, 0, 0);
    return d;
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), buildDate());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5">
        <h2 className="text-lg font-bold tracking-tight">Save Setlist</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 uppercase tracking-widest">Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="e.g. Vinh's Grad Party"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 uppercase tracking-widest">Party Start</label>
          <input
            type="time"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 transition-colors [color-scheme:dark]"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-white text-black font-bold text-sm hover:bg-zinc-200 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
