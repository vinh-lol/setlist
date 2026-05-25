"use client";

import type { SpotifyPlaylist } from "@/lib/types";

interface Props {
  playlists: SpotifyPlaylist[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function PlaylistPicker({ playlists, selectedId, onSelect }: Props) {
  return (
    <select
      value={selectedId}
      onChange={(e) => onSelect(e.target.value)}
      className="bg-zinc-800 text-white text-sm px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 focus:outline-none focus:border-zinc-400 transition-colors max-w-[240px] truncate"
    >
      <option value="">Pick a playlist…</option>
      {playlists.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.trackCount})
        </option>
      ))}
    </select>
  );
}
