"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import type { SpotifyTrack } from "@/lib/types";
import { formatDuration } from "@/lib/timeline";

interface SearchResult {
  id: string;
  playId: string;
  name: string;
  artists: string[];
  duration_ms: number;
  albumName: string;
  albumArt: string;
}

interface Props {
  accessToken: string;
  onAdd: (track: SpotifyTrack) => void;
}

export default function SearchPicker({ accessToken, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(q: string) {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=8`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      const tracks: SearchResult[] = (data.tracks?.items ?? []).map((t: {
        id: string; name: string;
        artists: { name: string }[];
        duration_ms: number;
        album: { name: string; images: { url: string }[] };
      }) => ({
        id: t.id,
        playId: crypto.randomUUID(),
        name: t.name,
        artists: t.artists.map((a) => a.name),
        duration_ms: t.duration_ms,
        albumName: t.album.name,
        albumArt: t.album.images?.[0]?.url ?? "",
      }));
      setResults(tracks);
      setOpen(true);
    } catch {
      // ignore search errors
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  }

  function handleAdd(track: SearchResult) {
    onAdd(track);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search for a song…"
            className="bg-zinc-800 text-white text-sm px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors w-64"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-96 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 overflow-hidden">
          {results.map((track) => (
            <button
              key={track.id}
              onMouseDown={() => handleAdd(track)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 transition-colors text-left"
            >
              {track.albumArt && (
                <div className="relative w-9 h-9 shrink-0 rounded overflow-hidden">
                  <Image src={track.albumArt} alt="" fill sizes="36px" className="object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">{track.name}</p>
                <p className="text-zinc-400 text-xs truncate">{track.artists.join(", ")} · {track.albumName}</p>
              </div>
              <span className="text-zinc-500 text-xs shrink-0">{formatDuration(track.duration_ms)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
