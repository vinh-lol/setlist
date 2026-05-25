"use client";

import { useEffect, useState } from "react";
import type { SpotifyTrack } from "@/lib/types";

interface SavedMeta {
  code: string;
  name: string;
  partyStartMs: number;
  trackCount: number;
  createdAt: number;
}

interface Props {
  onLoad: (tracks: SpotifyTrack[], partyStart: Date) => void;
  onClose: () => void;
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MySetsPanel({ onLoad, onClose }: Props) {
  const [sets, setSets] = useState<SavedMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/my-setlists")
      .then((r) => r.json())
      .then((data) => setSets(Array.isArray(data) ? data : []))
      .catch(() => setSets([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleLoad(meta: SavedMeta) {
    setLoadingCode(meta.code);
    try {
      const res = await fetch(`/api/setlists/${meta.code}`);
      if (!res.ok) return;
      const data = await res.json();
      onLoad(data.tracks ?? [], new Date(data.partyStartMs));
      onClose();
    } finally {
      setLoadingCode(null);
    }
  }

  async function handleDelete(code: string) {
    setDeletingCode(code);
    try {
      await fetch(`/api/my-setlists/${code}`, { method: "DELETE" });
      setSets((prev) => prev.filter((s) => s.code !== code));
    } finally {
      setDeletingCode(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-bold tracking-tight">My Setlists</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">Loading…</div>
          ) : sets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-zinc-400 text-sm">No saved setlists yet</p>
              <p className="text-zinc-600 text-xs">Click Save to store the current setlist</p>
            </div>
          ) : (
            sets.map((meta) => (
              <div
                key={meta.code}
                className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800/60 hover:bg-zinc-800/40 group transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{meta.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {formatDate(meta.createdAt)} · starts {formatTime(meta.partyStartMs)} · {meta.trackCount} songs
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleLoad(meta)}
                    disabled={loadingCode === meta.code}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-40 transition-colors"
                  >
                    {loadingCode === meta.code ? "Loading…" : "Load"}
                  </button>
                  <button
                    onClick={() => handleDelete(meta.code)}
                    disabled={deletingCode === meta.code}
                    className="text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors text-sm px-1"
                    title="Delete"
                  >
                    {deletingCode === meta.code ? "…" : "✕"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
