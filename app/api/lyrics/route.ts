// Server-side proxy to LRCLIB (https://lrclib.net) — free, no API key, supports
// time-synced lyrics. Proxying avoids browser CORS and lets us cache on the CDN.

const UA = "Setlist Party Dashboard (https://github.com/vinh-lol/setlist)";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track")?.trim() ?? "";
  const artist = searchParams.get("artist")?.trim() ?? "";
  const album = searchParams.get("album")?.trim() ?? "";
  const duration = searchParams.get("duration")?.trim() ?? ""; // seconds

  if (!track || !artist) {
    return Response.json({ synced: null, plain: null }, { status: 400 });
  }

  const headers = { "User-Agent": UA };
  const ok = (synced: string | null, plain: string | null) =>
    Response.json(
      { synced: synced ?? null, plain: plain ?? null },
      { headers: { "Cache-Control": "public, s-maxage=86400, max-age=3600" } }
    );

  // 1. Exact match (duration-aware) — most accurate.
  try {
    const u = new URL("https://lrclib.net/api/get");
    u.searchParams.set("track_name", track);
    u.searchParams.set("artist_name", artist);
    if (album) u.searchParams.set("album_name", album);
    if (duration) u.searchParams.set("duration", duration);
    const r = await fetch(u, { headers });
    if (r.ok) {
      const d = await r.json();
      if (d?.syncedLyrics || d?.plainLyrics) return ok(d.syncedLyrics, d.plainLyrics);
    }
  } catch {
    // fall through to search
  }

  // 2. Fuzzy search fallback — prefer a result that has synced lyrics.
  try {
    const u = new URL("https://lrclib.net/api/search");
    u.searchParams.set("track_name", track);
    u.searchParams.set("artist_name", artist);
    const r = await fetch(u, { headers });
    if (r.ok) {
      const arr = await r.json();
      if (Array.isArray(arr) && arr.length > 0) {
        const best =
          arr.find((x) => x?.syncedLyrics) ?? arr.find((x) => x?.plainLyrics);
        if (best) return ok(best.syncedLyrics ?? null, best.plainLyrics ?? null);
      }
    }
  } catch {
    // fall through to empty
  }

  return ok(null, null);
}
