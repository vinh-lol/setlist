"use client";

import { useEffect, useState } from "react";

interface Track {
  id: string;
  name: string;
  artists: string[];
  albumArt: string;
}

export default function RequestPage() {
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("p") ?? "";
    setCode(p.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setResults(d.tracks ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function add(track: Track) {
    setAddedId(track.id);
    try {
      await fetch(`/api/party/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });
    } catch {}
    setTimeout(() => setAddedId((id) => (id === track.id ? null : id)), 1600);
  }

  if (!code) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center px-6 text-center">
        <p className="text-black/50">This link is missing its party code. Ask the host for the QR again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <header className="px-5 pt-8 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-black/40">Add a song</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">What should we play?</h1>
      </header>

      <div className="px-5 sticky top-0 bg-white pb-3 z-10">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search songs or artists…"
          className="w-full rounded-xl bg-black/[0.05] focus:bg-black/[0.08] outline-none px-4 py-3.5 text-base placeholder:text-black/40 transition-colors"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        {q.trim() && results.length === 0 && !searching && (
          <p className="text-black/40 text-sm py-6 text-center">No matches.</p>
        )}
        <div className="divide-y divide-black/5">
          {results.map((track) => {
            const added = addedId === track.id;
            return (
              <button
                key={track.id}
                onClick={() => add(track)}
                disabled={added}
                className="w-full flex items-center gap-3 py-2.5 text-left active:bg-black/[0.03] rounded-lg transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={track.albumArt} alt="" className="w-12 h-12 rounded object-cover shrink-0 bg-black/5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{track.name}</p>
                  <p className="text-sm text-black/50 truncate">{track.artists.join(", ")}</p>
                </div>
                <span className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-full transition-colors ${added ? "bg-black text-white" : "bg-black/[0.06] text-black"}`}>
                  {added ? "Added ✓" : "Add"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
