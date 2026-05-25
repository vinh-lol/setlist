import type { SpotifyTrack } from "./types";

// Spotify CDN URLs follow a predictable pattern — store just the 40-char hash
const SCDN = "https://i.scdn.co/image/ab67616d0000b273";

function artToCode(url: string): string {
  if (url.startsWith(SCDN) && url.length === SCDN.length + 40) {
    return url.slice(SCDN.length); // 40-char hex hash
  }
  return url; // non-standard URL: store as-is
}

function codeToArt(code: string): string {
  if (code.length === 40 && /^[0-9a-f]+$/.test(code)) {
    return SCDN + code;
  }
  return code;
}

export function encodeSetlist(tracks: SpotifyTrack[], partyStart: Date): string {
  const json = JSON.stringify({
    t: tracks.map(t => [t.id, t.name, t.artists, t.duration_ms, t.albumName, artToCode(t.albumArt)]),
    s: partyStart.getTime(),
  });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function decodeSetlist(encoded: string): { tracks: SpotifyTrack[]; partyStart: Date } | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);
    if (!Array.isArray(data.t) || typeof data.s !== "number") return null;
    return {
      tracks: data.t.map(([id, name, artists, duration_ms, albumName, artCode]: [string, string, string[], number, string, string?]) => ({
        id,
        playId: crypto.randomUUID(),
        name,
        artists,
        duration_ms,
        albumName,
        albumArt: artCode ? codeToArt(artCode) : "",
      })),
      partyStart: new Date(data.s),
    };
  } catch {
    return null;
  }
}
