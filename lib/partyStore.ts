// In-memory relay of guest song requests, keyed by party code. The host's /party
// page polls and drains this, then adds each track to Spotify from its own browser
// (so the host token never leaves the host). Module-singleton: persists for the
// life of the server process — fine for local/single-instance. On Vercel's
// serverless runtime this resets per invocation; a KV store (Upstash/Vercel KV)
// would be the drop-in replacement there.

export interface QueuedRequest {
  id: string;
  name: string;
  artists: string[];
  albumArt: string;
  at: number;
}

const store = new Map<string, QueuedRequest[]>();

export function addRequest(code: string, req: QueuedRequest) {
  const list = store.get(code) ?? [];
  list.push(req);
  store.set(code, list.slice(-50)); // cap to avoid unbounded growth
}

// Returns and clears the pending requests for a code (consume-once).
export function takeRequests(code: string): QueuedRequest[] {
  const list = store.get(code) ?? [];
  if (list.length) store.set(code, []);
  return list;
}
