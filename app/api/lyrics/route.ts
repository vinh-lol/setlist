// Server-side proxy to LRCLIB (https://lrclib.net) — free, no API key, supports
// time-synced lyrics. Proxying avoids browser CORS and lets us cache on the CDN.
//
// Spotify's own (Musixmatch) synced lyrics aren't available via any official API,
// so we lean on LRCLIB. Many "no synced" misses are really *match* misses:
// Spotify track titles carry decorations like "(feat. X)", "- Remastered 2019",
// "- Live", "(Deluxe)" that defeat the exact lookup. So we try the exact match
// first, then retry on a cleaned title, then a duration-aware search — always
// preferring a synced result before falling back to plain/none.

const UA = "Setlist Party Dashboard (https://github.com/vinh-lol/setlist)";

interface LrcRecord {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
  duration?: number | null;
}

// Strip the decorations Spotify appends so LRCLIB can match the core title.
const DECORATORS = /(remaster(ed)?|live|version|edit|mix|remix|acoustic|deluxe|bonus|radio|mono|stereo|anniversary|single|explicit)/i;
function cleanTitle(name: string): string {
  return name
    .replace(/\s*[([](feat\.?|with)[^)\]]*[)\]]/gi, "") // (feat. …) / (with …)
    .replace(new RegExp(`\\s*[([][^)\\]]*${DECORATORS.source}[^)\\]]*[)\\]]`, "gi"), "") // (… Remaster …)
    .replace(new RegExp(`\\s*-\\s*[^-]*${DECORATORS.source}.*$`, "i"), "") // - 2011 Remaster …
    .replace(/\s+/g, " ")
    .trim();
}

const synced = (r?: LrcRecord | null) => (r?.syncedLyrics ? r : null);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track")?.trim() ?? "";
  const artist = searchParams.get("artist")?.trim() ?? "";
  const album = searchParams.get("album")?.trim() ?? "";
  const durationStr = searchParams.get("duration")?.trim() ?? ""; // seconds
  const duration = durationStr ? Number(durationStr) : NaN;

  if (!track || !artist) {
    return Response.json({ synced: null, plain: null }, { status: 400 });
  }

  const headers = { "User-Agent": UA };
  const ok = (r: LrcRecord | null) =>
    Response.json(
      { synced: r?.syncedLyrics ?? null, plain: r?.plainLyrics ?? null },
      { headers: { "Cache-Control": "public, s-maxage=86400, max-age=3600" } }
    );

  const get = async (t: string, a: string, withAlbum: boolean): Promise<LrcRecord | null> => {
    try {
      const u = new URL("https://lrclib.net/api/get");
      u.searchParams.set("track_name", t);
      u.searchParams.set("artist_name", a);
      if (withAlbum && album) u.searchParams.set("album_name", album);
      if (durationStr) u.searchParams.set("duration", durationStr);
      const r = await fetch(u, { headers });
      if (!r.ok) return null;
      const d = (await r.json()) as LrcRecord;
      return d?.syncedLyrics || d?.plainLyrics ? d : null;
    } catch {
      return null;
    }
  };

  const search = async (t: string, a: string): Promise<LrcRecord[]> => {
    try {
      const u = new URL("https://lrclib.net/api/search");
      u.searchParams.set("track_name", t);
      u.searchParams.set("artist_name", a);
      const r = await fetch(u, { headers });
      if (!r.ok) return [];
      const arr = await r.json();
      return Array.isArray(arr) ? (arr as LrcRecord[]) : [];
    } catch {
      return [];
    }
  };

  // Among candidates, prefer synced, then the one whose duration is closest to
  // the track (guards against matching a different version/edit).
  const best = (records: LrcRecord[], wantSynced: boolean): LrcRecord | null => {
    const pool = records.filter((r) => (wantSynced ? r.syncedLyrics : r.plainLyrics));
    if (!pool.length) return null;
    if (Number.isNaN(duration)) return pool[0];
    return pool.reduce((a, b) =>
      Math.abs((b.duration ?? 1e9) - duration) < Math.abs((a.duration ?? 1e9) - duration) ? b : a
    );
  };

  const cleaned = cleanTitle(track);

  // 1. Exact match on the original title (duration-aware) — most accurate.
  let exact = await get(track, artist, true);
  if (synced(exact)) return ok(exact);

  // 2. Retry exact on the cleaned title (drops feat/remaster/etc), no album.
  let exactClean: LrcRecord | null = null;
  if (cleaned && cleaned.toLowerCase() !== track.toLowerCase()) {
    exactClean = await get(cleaned, artist, false);
    if (synced(exactClean)) return ok(exactClean);
  }

  // 3. Search by cleaned title — pick the closest-duration result WITH synced.
  const results = await search(cleaned || track, artist);
  const syncedHit = best(results, true);
  if (syncedHit) return ok(syncedHit);

  // 4. No synced anywhere — return best plain (the page hides it via the
  //    no-lyrics layout, but keep it available for future use).
  return ok(exact ?? exactClean ?? best(results, false));
}
