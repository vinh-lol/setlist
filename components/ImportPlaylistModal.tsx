"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { SpotifyTrack } from "@/lib/types";
import { getUserPlaylists } from "@/lib/spotify";

interface Props {
  accessToken: string;
  onImport: (tracks: SpotifyTrack[]) => void;
  onClose: () => void;
}

export default function ImportPlaylistModal({ accessToken, onImport, onClose }: Props) {
  const [playlists, setPlaylists] = useState<{ id: string; name: string; imageUrl: string; trackCount: number }[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    getUserPlaylists(accessToken)
      .then(setPlaylists)
      .catch(() => setPlaylists([]))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const visible = playlists.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  async function handleImport(id: string) {
    setImporting(id);
    try {
      // Only fetch the first 50 tracks — the live Spotify queue sync drives the
      // window forward automatically as songs play through the rest of the playlist.
      const res = await fetch(
        `https://api.spotify.com/v1/playlists/${id}/tracks?limit=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      const tracks: SpotifyTrack[] = (data.items ?? [])
        .map((item: { track: { id: string; name: string; duration_ms: number; is_local?: boolean; artists: { name: string }[]; album: { name: string; images: { url: string }[] } } }) => item?.track)
        .filter((t: { id: string; duration_ms: number; is_local?: boolean } | null) => t && t.duration_ms && !t.is_local)
        .map((t: { id: string; name: string; duration_ms: number; artists: { name: string }[]; album: { name: string; images: { url: string }[] } }) => ({
          id: t.id,
          playId: crypto.randomUUID(),
          name: t.name,
          artists: t.artists.map((a: { name: string }) => a.name),
          duration_ms: t.duration_ms,
          albumName: t.album?.name ?? "",
          albumArt: t.album?.images?.[0]?.url ?? "",
        }));
      onImport(tracks);
      onClose();
    } finally {
      setImporting(null);
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
          <h2 className="text-base font-bold tracking-tight">Import Playlist</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <input
            autoFocus
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter playlists…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">Loading playlists…</div>
          ) : visible.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">No playlists found</div>
          ) : (
            visible.map((p) => (
              <button
                key={p.id}
                onClick={() => handleImport(p.id)}
                disabled={!!importing}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 hover:bg-zinc-800/40 disabled:opacity-50 transition-colors text-left"
              >
                {p.imageUrl ? (
                  <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden">
                    <Image src={p.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 shrink-0 rounded bg-zinc-700" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <p className="text-zinc-500 text-xs">{p.trackCount} songs</p>
                </div>
                {importing === p.id ? (
                  <span className="text-zinc-400 text-xs shrink-0">Loading…</span>
                ) : (
                  <span className="text-zinc-500 text-xs shrink-0">
                    {p.trackCount > 50 ? "First 50" : `${p.trackCount} songs`}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
