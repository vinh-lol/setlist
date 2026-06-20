import type { SpotifyPlaylist, SpotifyTrack } from "./types";

const BASE = "https://api.spotify.com/v1";

async function spotifyFetch(token: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "5", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return spotifyFetch(token, url);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`Spotify API error ${res.status}: ${url} — ${body}`);
  }
  return res.json();
}

export async function getUserPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let url: string | null = `${BASE}/me/playlists?limit=50`;

  while (url) {
    const data = await spotifyFetch(token, url);
    for (const item of data.items) {
      if (!item) continue;
      playlists.push({
        id: item.id,
        name: item.name,
        imageUrl: item.images?.[0]?.url ?? "",
        trackCount: item.tracks?.total ?? 0,
      });
    }
    url = data.next;
  }

  return playlists;
}

export async function getPlaylistTracks(
  token: string,
  playlistId: string
): Promise<SpotifyTrack[]> {
  const firstData = await spotifyFetch(
    token,
    `${BASE}/playlists/${playlistId}/tracks?limit=100`
  );

  const total: number = firstData.total;
  const allPages = [firstData];

  if (total > 100) {
    const offsets = Array.from(
      { length: Math.ceil((total - 100) / 100) },
      (_, i) => (i + 1) * 100
    );
    const rest = await Promise.all(
      offsets.map((offset) =>
        spotifyFetch(
          token,
          `${BASE}/playlists/${playlistId}/tracks?limit=100&offset=${offset}`
        )
      )
    );
    allPages.push(...rest);
  }

  const tracks: SpotifyTrack[] = [];
  for (const page of allPages) {
    for (const item of page.items) {
      const t = item?.track;
      if (!t || !t.duration_ms || t.is_local) continue;
      tracks.push({
        id: t.id,
        playId: crypto.randomUUID(),
        name: t.name,
        artists: (t.artists ?? []).map((a: { name: string }) => a.name),
        duration_ms: t.duration_ms,
        albumName: t.album?.name ?? "",
        albumArt: t.album?.images?.[0]?.url ?? "",
      });
    }
  }

  return tracks;
}

export async function getQueue(token: string): Promise<SpotifyTrack[]> {
  const res = await fetch(`${BASE}/me/player/queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();

  const tracks: SpotifyTrack[] = [];

  const toTrack = (t: {
    id: string; name: string; duration_ms: number; is_local?: boolean;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
  }): SpotifyTrack | null => {
    if (!t || !t.duration_ms || t.is_local) return null;
    return {
      id: t.id,
      playId: crypto.randomUUID(),
      name: t.name,
      artists: t.artists.map((a) => a.name),
      duration_ms: t.duration_ms,
      albumName: t.album?.name ?? "",
      albumArt: t.album?.images?.[0]?.url ?? "",
    };
  };

  if (data.currently_playing) {
    const t = toTrack(data.currently_playing);
    if (t) tracks.push(t);
  }
  for (const item of data.queue ?? []) {
    const t = toTrack(item);
    if (t) tracks.push(t);
  }

  return tracks;
}

export async function getTracks(token: string, ids: string[]): Promise<SpotifyTrack[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const pages = await Promise.all(
    chunks.map(chunk => spotifyFetch(token, `${BASE}/tracks?ids=${chunk.join(",")}`))
  );
  const tracks: SpotifyTrack[] = [];
  for (const data of pages) {
    for (const t of data.tracks ?? []) {
      if (!t || !t.duration_ms) continue;
      tracks.push({
        id: t.id,
        playId: crypto.randomUUID(),
        name: t.name,
        artists: (t.artists ?? []).map((a: { name: string }) => a.name),
        duration_ms: t.duration_ms,
        albumName: t.album?.name ?? "",
        albumArt: t.album?.images?.[0]?.url ?? "",
      });
    }
  }
  return tracks;
}

export async function setPlayOrder(
  token: string,
  trackIds: string[],
  currentProgressMs: number
): Promise<void> {
  if (trackIds.length === 0) return;
  await fetch(`${BASE}/me/player/play`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      uris: trackIds.map((id) => `spotify:track:${id}`),
      offset: { position: 0 },
      position_ms: Math.max(0, Math.round(currentProgressMs)),
    }),
  });
}

export async function addToQueue(token: string, trackId: string): Promise<void> {
  await fetch(`${BASE}/me/player/queue?uri=spotify:track:${trackId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function pausePlayback(token: string): Promise<void> {
  await fetch(`${BASE}/me/player/pause`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function resumePlayback(token: string): Promise<void> {
  await fetch(`${BASE}/me/player/play`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function skipNext(token: string): Promise<void> {
  await fetch(`${BASE}/me/player/next`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function skipPrevious(token: string): Promise<void> {
  await fetch(`${BASE}/me/player/previous`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getCurrentlyPlaying(
  token: string
): Promise<{ trackId: string; progressMs: number; isPlaying: boolean; track: SpotifyTrack | null } | null> {
  const res = await fetch(`${BASE}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.item) return null;
  const t = data.item;
  const track: SpotifyTrack | null = t.id
    ? {
        id: t.id,
        playId: crypto.randomUUID(),
        name: t.name,
        artists: (t.artists ?? []).map((a: { name: string }) => a.name),
        duration_ms: t.duration_ms ?? 0,
        albumName: t.album?.name ?? "",
        albumArt: t.album?.images?.[0]?.url ?? "",
      }
    : null;
  return { trackId: t.id, progressMs: data.progress_ms ?? 0, isPlaying: data.is_playing ?? false, track };
}
