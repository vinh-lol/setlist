"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import SearchPicker from "@/components/SearchPicker";
import TimePicker from "@/components/TimePicker";
import Timeline from "@/components/Timeline";
import SharePanel from "@/components/SharePanel";
import SaveSetlistModal from "@/components/SaveSetlistModal";
import MySetsPanel from "@/components/MySetsPanel";
import ImportPlaylistModal from "@/components/ImportPlaylistModal";
import type { SpotifyTrack } from "@/lib/types";
import { buildTimeline } from "@/lib/timeline";
import { getQueue, getCurrentlyPlaying, addToQueue, setPlayOrder } from "@/lib/spotify";
import { encodeSetlist, decodeSetlist } from "@/lib/share";

function defaultPartyStart(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

// Merges incoming Spotify tracks (fresh playIds) with local tracks (stable playIds).
// Greedily matches by track.id to preserve existing playIds; unmatched incoming
// tracks keep their freshly generated playId (they're new to the queue).
function mergeQueue(incoming: SpotifyTrack[], local: SpotifyTrack[]): SpotifyTrack[] {
  const available = [...local];
  return incoming.map((track) => {
    const idx = available.findIndex((t) => t.id === track.id);
    if (idx !== -1) return available.splice(idx, 1)[0];
    return track;
  });
}

export default function SetlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [partyStart, setPartyStart] = useState<Date>(defaultPartyStart);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [mySetsOpen, setMySetsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"timeline" | "queue">("timeline");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [queuedIds, setQueuedIds] = useState<string[]>([]);
  const [playedTracks, setPlayedTracks] = useState<SpotifyTrack[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ref version for synchronous reads inside setTracks updater
  const queuedIdsRef = useRef<Set<string>>(new Set());
  // mirrors tracks + playedTracks state for synchronous reads in poll callback
  const tracksRef = useRef<SpotifyTrack[]>([]);
  const playedTracksRef = useRef<SpotifyTrack[]>([]);

  // Cooldown: suppress Spotify queue sync for ~4s after addToQueue so the
  // optimistically-inserted track doesn't flicker out before Spotify reflects it.
  const queueSyncCooldownRef = useRef<number>(0);
  // Cooldown: suppress Spotify merge for ~6s after a reorder so the poll doesn't
  // overwrite the local reorder before Spotify has processed setPlayOrder.
  const reorderCooldownRef = useRef<number>(0);
  // Persisted queue tags: Spotify track IDs (stable across sessions) stored in
  // localStorage so "queued" badges survive a page refresh.
  const persistedQueuedTrackIdsRef = useRef<Set<string>>(new Set());

  const lastSyncedIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string>("");

  tokenRef.current = session?.accessToken ?? "";
  tracksRef.current = tracks;
  playedTracksRef.current = playedTracks;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // Load persisted queue track IDs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("setlist-queued");
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        persistedQueuedTrackIdsRef.current = new Set(ids);
      }
    } catch {}
  }, []);

  // Decode setlist from URL on mount — albumArt is included in the encoding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s");
    if (!s) return;
    const decoded = decodeSetlist(s);
    if (!decoded) return;
    setTracks(decoded.tracks);
    setPartyStart(decoded.partyStart);
  }, []);

  // Auto-update URL and share link whenever setlist changes
  useEffect(() => {
    if (tracks.length === 0) {
      history.replaceState(null, "", "/setlist");
      setShareUrl("");
      return;
    }
    const encoded = encodeSetlist(tracks, partyStart);
    history.replaceState(null, "", `/setlist?s=${encoded}`);
    setShareUrl(`${window.location.origin}/view?s=${encoded}`);
  }, [tracks, partyStart]);

  // Auto-save to the live share link whenever setlist changes (1s debounce)
  useEffect(() => {
    if (!shareCode || tracks.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch(`/api/setlists/${shareCode}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks, playedTracks, partyStartMs: partyStart.getTime() }),
      }).catch(() => {});
    }, 50);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tracks, playedTracks, partyStart, shareCode]);

  const syncFromSpotify = useCallback(async (token: string) => {
    try {
      const [queued, nowPlaying] = await Promise.all([
        getQueue(token),
        getCurrentlyPlaying(token),
      ]);
      if (!nowPlaying) return;

      const trackChanged = nowPlaying.trackId !== lastSyncedIdRef.current;

      const incomingIdStr = queued.map((t) => t.id).join(",");
      const localIdStr = tracksRef.current.map((t) => t.id).join(",");
      const localRestStr = tracksRef.current.slice(1).map((t) => t.id).join(",");
      const queueChanged = incomingIdStr !== localIdStr;

      // Same song queued twice: track ID didn't change but the queue dropped one from the front.
      // Use prefix check (not equality) because Spotify may return more songs than our local list.
      const songFinishedByQueueDrop =
        !trackChanged && queueChanged && localRestStr.length > 0 &&
        (incomingIdStr === localRestStr || incomingIdStr.startsWith(localRestStr + ","));

      // --- Transition detection ---
      // Look up nowPlaying.trackId across ALL known tracks (played + upcoming) to handle:
      //   rewind  : nowIdx < playedCount  → restore tracks from playedTracks
      //   multi-skip: nowIdx > playedCount → move all skipped tracks to history at once
      //   normal  : nowIdx === playedCount → one song finished (existing behaviour)
      //   unknown : nowIdx === -1          → external track; assume one finished
      let finishedTracks: SpotifyTrack[] = [];
      let localForMerge: SpotifyTrack[] = tracksRef.current;
      let isRewind = false;

      if (trackChanged && lastSyncedIdRef.current !== null) {
        const allKnown = [...playedTracksRef.current, ...tracksRef.current];
        const playedCount = playedTracksRef.current.length;
        const nowIdxInAll = allKnown.findIndex((t) => t.id === nowPlaying.trackId);

        if (nowIdxInAll >= 0 && nowIdxInAll < playedCount) {
          // REWIND: the playing track is in playedTracks — restore it and everything after it.
          isRewind = true;
          const restoredFromPlayed = playedTracksRef.current.slice(nowIdxInAll);
          setPlayedTracks((prev) => prev.slice(0, nowIdxInAll));
          // Merge against restored tracks + current upcoming tracks
          localForMerge = [...restoredFromPlayed, ...tracksRef.current];
          // finishedTracks stays [] — nothing new moved to history during a rewind
        } else {
          // FORWARD: either normal (1 song), multi-skip (N songs), or unknown external track.
          const finishCount =
            nowIdxInAll === -1
              ? 1 // unknown track → assume one song finished
              : Math.max(1, nowIdxInAll - playedCount); // multi-skip
          finishedTracks = tracksRef.current.slice(0, finishCount);
          localForMerge = tracksRef.current.slice(finishCount);

          if (finishedTracks.length > 0) {
            setPlayedTracks((prev) => [...prev, ...finishedTracks]);
            // Clean up persisted tags for every finished track
            let persistedChanged = false;
            finishedTracks.forEach((t) => {
              if (persistedQueuedTrackIdsRef.current.has(t.id)) {
                persistedQueuedTrackIdsRef.current.delete(t.id);
                persistedChanged = true;
              }
            });
            if (persistedChanged) {
              try { localStorage.setItem("setlist-queued", JSON.stringify([...persistedQueuedTrackIdsRef.current])); } catch {}
            }
          }
        }
      } else if (songFinishedByQueueDrop) {
        // Same-track repeat: one instance finished.
        finishedTracks = tracksRef.current.slice(0, 1);
        localForMerge = tracksRef.current.slice(1);
        if (finishedTracks[0]) {
          setPlayedTracks((prev) => [...prev, finishedTracks[0]]);
          if (persistedQueuedTrackIdsRef.current.has(finishedTracks[0].id)) {
            persistedQueuedTrackIdsRef.current.delete(finishedTracks[0].id);
            try { localStorage.setItem("setlist-queued", JSON.stringify([...persistedQueuedTrackIdsRef.current])); } catch {}
          }
        }
      }

      const anyFinished = finishedTracks.length > 0;

      // If tracks moved to history but the Spotify queue hasn't reflected it yet,
      // slice them off manually so no playId appears in both playedTracks and tracks.
      if (anyFinished && !queueChanged) setTracks((prev) => prev.slice(finishedTracks.length));

      // Will hold the final track list so we can apply persisted tags after.
      let effectiveTracks: SpotifyTrack[] | null = null;

      if (queueChanged && queued.length > 0) {
        const inReorderCooldown = Date.now() < reorderCooldownRef.current;

        if (inReorderCooldown && !anyFinished && !isRewind) {
          // A reorder just happened: Spotify's response may contain duplicates or the old
          // order. Skip the merge entirely to preserve the local reorder, but only when
          // no song transition occurred (song transitions still need to update tracks).
          // Do nothing — local tracks state is already correct.
        } else {
          const merged = mergeQueue(queued, localForMerge);

          // Fix queue flicker: Spotify's /queue endpoint lags ~2-4s after addToQueue.
          // During the cooldown window, re-inject any locally-queued tracks that haven't
          // appeared in Spotify's response yet so they don't briefly vanish.
          const inAddCooldown = Date.now() < queueSyncCooldownRef.current;
          if (inAddCooldown) {
            const mergedPlayIds = new Set(merged.map((t) => t.playId));
            const pendingMissing = localForMerge.filter(
              (t) => queuedIdsRef.current.has(t.playId) && !mergedPlayIds.has(t.playId)
            );
            if (pendingMissing.length > 0) {
              // Insert right after currently-playing and any already-confirmed queued tracks
              let insertAfter = 0;
              for (let i = 1; i < merged.length; i++) {
                if (queuedIdsRef.current.has(merged[i].playId)) insertAfter = i;
                else break;
              }
              merged.splice(insertAfter + 1, 0, ...pendingMissing);
            }
          }

          // After initial sync: tag tracks that were explicitly queued in Spotify.
          // Guard 1 — lastSyncedIdRef: skip on first-ever sync.
          // Guard 2 — contextChanged: if merged[0] (currently playing) is not in our
          //   local state, the user switched playlists entirely in Spotify. Every track
          //   is "new" but none were user-queued — skip tagging.
          // Guard 3 — idx < localForMerge.length: tracks inserted near the front were
          //   explicitly queued; tracks appended at the tail just rolled in naturally.
          if (lastSyncedIdRef.current !== null) {
            const prevPlayIds = new Set(localForMerge.map((t) => t.playId));
            const contextChanged = merged.length > 0 && !prevPlayIds.has(merged[0].playId);
            if (!contextChanged) {
              const newlyQueued = merged.filter(
                (t, idx) =>
                  !prevPlayIds.has(t.playId) &&
                  !queuedIdsRef.current.has(t.playId) &&
                  idx < localForMerge.length
              );
              if (newlyQueued.length > 0) {
                newlyQueued.forEach((t) => queuedIdsRef.current.add(t.playId));
                setQueuedIds((prev) => [...prev, ...newlyQueued.map((t) => t.playId)]);
              }
            }
          }

          effectiveTracks = merged;
          setTracks(merged);
        }
      }

      // Restore persisted queue tags (track IDs from localStorage) to current tracks.
      // This re-applies "queued" badges after a page refresh, when playIds are all new.
      if (persistedQueuedTrackIdsRef.current.size > 0) {
        const tracksToTag = effectiveTracks ?? tracksRef.current;
        const untagged = tracksToTag.filter(
          (t) => persistedQueuedTrackIdsRef.current.has(t.id) && !queuedIdsRef.current.has(t.playId)
        );
        if (untagged.length > 0) {
          untagged.forEach((t) => queuedIdsRef.current.add(t.playId));
          setQueuedIds((prev) => [...prev, ...untagged.map((t) => t.playId)]);
        }
      }
      if (trackChanged) {
        setPartyStart(new Date(Date.now() - nowPlaying.progressMs));
        lastSyncedIdRef.current = nowPlaying.trackId;
      } else if (songFinishedByQueueDrop) {
        setPartyStart(new Date(Date.now() - nowPlaying.progressMs));
      } else if (!nowPlaying.isPlaying) {
        // While paused, progressMs is frozen but real time keeps moving.
        // Update partyStart each poll so upcoming song times stay accurate
        // (e.g. a 5-minute pause pushes all future times 5 minutes later).
        // The NowIndicator is unaffected — it uses the anchor system, not partyStart.
        setPartyStart(new Date(Date.now() - nowPlaying.progressMs));
      }
    } catch {
      // ignore transient errors
    }
  }, []);

  // Always-on polling — always syncs queue, not just on track change
  useEffect(() => {
    if (!tokenRef.current) return;
    const poll = () => syncFromSpotify(tokenRef.current);
    poll();
    const id = setInterval(poll, 2_000);
    return () => clearInterval(id);
  }, [syncFromSpotify, status]);

  function addTrack(track: SpotifyTrack) {
    queuedIdsRef.current.add(track.playId);
    setQueuedIds((prev) => [...prev, track.playId]);
    // Persist by Spotify track ID (stable across refreshes) so the badge survives reload
    persistedQueuedTrackIdsRef.current.add(track.id);
    try { localStorage.setItem("setlist-queued", JSON.stringify([...persistedQueuedTrackIdsRef.current])); } catch {}
    // Give Spotify's /queue endpoint 4s to reflect the addition before we trust it
    queueSyncCooldownRef.current = Date.now() + 4000;
    setTracks((prev) => {
      // Insert right after current song and any already-queued songs
      const queuedCount = prev.slice(1).filter((t) => queuedIdsRef.current.has(t.playId)).length;
      const insertPos = Math.min(1 + queuedCount, prev.length);
      const next = [...prev];
      next.splice(insertPos, 0, track);
      return next;
    });
    if (tokenRef.current) addToQueue(tokenRef.current, track.id).catch(() => {});
  }

  function removeTrack(index: number) {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  }

  function reorderTracks(from: number, to: number) {
    if (from <= 0 || to <= 0 || from === to) return;
    const next = [...tracksRef.current];
    if (from >= next.length || to >= next.length) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTracks(next);

    // Suppress Spotify merge for 6s so the poll doesn't overwrite the local reorder
    // before Spotify has processed setPlayOrder.
    reorderCooldownRef.current = Date.now() + 6000;

    if (tokenRef.current) {
      const progressMs = Math.max(0, Date.now() - partyStart.getTime());
      // Exclude user-queued tracks from setPlayOrder: they are already in Spotify's
      // user queue (via addToQueue) and including them in the context too would cause
      // getQueue to return them twice, creating visible duplicates.
      const contextTracks = next.filter((t) => !queuedIdsRef.current.has(t.playId));
      setPlayOrder(tokenRef.current, contextTracks.map((t) => t.id), progressMs).catch(() => {});
    }
  }

  function moveTrack(index: number, dir: -1 | 1) {
    reorderTracks(index, index + dir);
  }

  // Prepend history so the timeline covers the full set from the start
  const playedMs = playedTracks.reduce((sum, t) => sum + t.duration_ms, 0);
  const setStart = new Date(partyStart.getTime() - playedMs);
  const allTracks = [...playedTracks, ...tracks];
  const entries = allTracks.length > 0 ? buildTimeline(allTracks, setStart) : [];

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400 text-sm">Loading...</div>
      </div>
    );
  }

  async function handleSaveSetlist(name: string, start: Date) {
    const res = await fetch("/api/my-setlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tracks, playedTracks, partyStartMs: start.getTime() }),
    });
    if (res.ok) {
      setPartyStart(start);
      setSaveOpen(false);
    }
  }

  function handleLoadSetlist(loadedTracks: SpotifyTrack[], start: Date) {
    setTracks(loadedTracks);
    setPlayedTracks([]);
    setPartyStart(start);
    setShareCode(null);
    setShareUrl("");
    setQueuedIds([]);
    queuedIdsRef.current.clear();
    persistedQueuedTrackIdsRef.current.clear();
    try { localStorage.removeItem("setlist-queued"); } catch {}
    lastSyncedIdRef.current = null;
  }

  function handleImportPlaylist(importedTracks: SpotifyTrack[]) {
    setTracks(importedTracks);
    setPlayedTracks([]);
    setShareCode(null);
    setShareUrl("");
    setQueuedIds([]);
    queuedIdsRef.current.clear();
    persistedQueuedTrackIdsRef.current.clear();
    try { localStorage.removeItem("setlist-queued"); } catch {}
    lastSyncedIdRef.current = null;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {shareOpen && shareUrl && (
        <SharePanel url={shareUrl} onClose={() => setShareOpen(false)} />
      )}
      {saveOpen && (
        <SaveSetlistModal
          defaultName=""
          partyStart={partyStart}
          onSave={handleSaveSetlist}
          onClose={() => setSaveOpen(false)}
        />
      )}
      {mySetsOpen && (
        <MySetsPanel
          onLoad={handleLoadSetlist}
          onClose={() => setMySetsOpen(false)}
        />
      )}
      {importOpen && session?.accessToken && (
        <ImportPlaylistModal
          accessToken={session.accessToken}
          onImport={handleImportPlaylist}
          onClose={() => setImportOpen(false)}
        />
      )}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0 gap-2">
        <h1 className="text-xl font-black tracking-tighter select-none shrink-0">SETLIST</h1>

        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
          {session?.accessToken && (
            <SearchPicker accessToken={session.accessToken} onAdd={addTrack} />
          )}
          <TimePicker value={partyStart} onChange={setPartyStart} />

          {/* Desktop-only action buttons */}
          <div className="hidden md:flex items-center gap-1.5">
            <div className="w-px h-5 bg-zinc-700 mx-1" />

            {session?.accessToken && (
              <button onClick={() => setImportOpen(true)} title="Import Playlist" className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
              </button>
            )}

            <button onClick={() => setMySetsOpen(true)} title="My Sets" className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </button>

            {tracks.length > 0 && (
              <button onClick={() => setSaveOpen(true)} title="Save Setlist" className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                </svg>
              </button>
            )}

            {tracks.length > 0 && (
              <button
                onClick={async () => {
                  if (shareCode) { setShareOpen(true); return; }
                  setShareLoading(true);
                  try {
                    const res = await fetch("/api/setlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracks, partyStartMs: partyStart.getTime() }) });
                    const { code } = await res.json();
                    setShareCode(code);
                    setShareUrl(`${window.location.origin}/view/${code}`);
                    setShareOpen(true);
                  } finally { setShareLoading(false); }
                }}
                disabled={shareLoading}
                title={shareCode ? "View Share Link" : "Share Setlist"}
                className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${shareCode ? "text-[#1DB954] hover:bg-zinc-800" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
              >
                {shareLoading ? <div className="w-[15px] h-[15px] border border-zinc-400 border-t-transparent rounded-full animate-spin" /> : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                )}
              </button>
            )}

            <div className="w-px h-5 bg-zinc-700 mx-1" />

            <button onClick={() => signOut({ callbackUrl: "/" })} title="Sign Out" className="p-2 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>

          {/* Mobile overflow menu */}
          <div className="relative md:hidden">
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>
              </svg>
            </button>
            {mobileMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 min-w-[180px]">
                  {session?.accessToken && (
                    <button onClick={() => { setImportOpen(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                      Import Playlist
                    </button>
                  )}
                  <button onClick={() => { setMySetsOpen(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    My Sets
                  </button>
                  {tracks.length > 0 && (
                    <button onClick={() => { setSaveOpen(true); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                      </svg>
                      Save Setlist
                    </button>
                  )}
                  {tracks.length > 0 && (
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        if (shareCode) { setShareOpen(true); return; }
                        setShareLoading(true);
                        try {
                          const res = await fetch("/api/setlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tracks, partyStartMs: partyStart.getTime() }) });
                          const { code } = await res.json();
                          setShareCode(code);
                          setShareUrl(`${window.location.origin}/view/${code}`);
                          setShareOpen(true);
                        } finally { setShareLoading(false); }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-800 transition-colors ${shareCode ? "text-[#1DB954]" : "text-zinc-300 hover:text-white"}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      {shareCode ? "View Share Link" : "Share Setlist"}
                    </button>
                  )}
                  <div className="h-px bg-zinc-800 my-1" />
                  <button onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: "/" }); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full text-zinc-500 gap-3">
            <p className="text-lg">Build your setlist</p>
            <p className="text-sm text-zinc-600 text-center px-6">
              Search for songs above, or start playing a playlist in Spotify
            </p>
          </div>
        ) : (
          <>
            {/* Desktop: sidebar + timeline side-by-side */}
            <div className="hidden md:flex flex-1 overflow-hidden">
              <div className="w-64 shrink-0 border-r border-zinc-800 overflow-y-auto flex flex-col">
                <div className="px-3 py-2 text-xs text-zinc-500 uppercase tracking-widest border-b border-zinc-800 flex items-center justify-between">
                  <span>{allTracks.length} song{allTracks.length !== 1 ? "s" : ""}</span>
                  <span className="flex items-center gap-1 text-[#1DB954] text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse" />
                    live
                  </span>
                </div>
                {playedTracks.map((track, i) => (
                  <div key={track.playId ?? "played-" + track.id + "-" + i} className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/30 opacity-35">
                    <div className="min-w-0 flex-1">
                      <p className="text-zinc-400 text-xs font-medium truncate line-through">{track.name}</p>
                      <p className="text-zinc-600 text-[10px] truncate">{track.artists.join(", ")}</p>
                    </div>
                  </div>
                ))}
                {playedTracks.length > 0 && (
                  <div className="px-3 py-1 text-[9px] text-zinc-600 uppercase tracking-widest bg-zinc-900/60 border-b border-zinc-800">now playing</div>
                )}
                {tracks.map((track, i) => {
                  const isQueued = queuedIds.includes(track.playId);
                  return (
                    <div
                      key={track.playId ?? track.id + "-" + i}
                      className="slide-in-right flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 group hover:bg-zinc-800/40"
                      style={{ animationDelay: isQueued ? "0ms" : `${Math.min(i * 20, 300)}ms`, opacity: 0, animationFillMode: "forwards" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-white text-xs font-medium truncate">{track.name}</p>
                          {isQueued && <span className="shrink-0 text-[9px] font-bold px-1 py-px rounded bg-[#1DB954]/20 text-[#1DB954] uppercase tracking-wide">queued</span>}
                        </div>
                        <p className="text-zinc-500 text-[10px] truncate">{track.artists.join(", ")}</p>
                      </div>
                      {i > 0 && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => moveTrack(i, -1)} disabled={i <= 1} className="text-zinc-400 hover:text-white disabled:opacity-20 text-xs px-1">↑</button>
                          <button onClick={() => moveTrack(i, 1)} disabled={i === tracks.length - 1} className="text-zinc-400 hover:text-white disabled:opacity-20 text-xs px-1">↓</button>
                          <button onClick={() => removeTrack(i)} className="text-zinc-400 hover:text-red-400 text-xs px-1">✕</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex-1 overflow-hidden">
                <Timeline entries={entries} partyStart={setStart} accessToken={session?.accessToken ?? ""} playedCount={playedTracks.length} onReorder={reorderTracks} queuedIds={queuedIds} />
              </div>
            </div>

            {/* Mobile: single panel, switched by bottom tabs */}
            <div className="flex md:hidden flex-1 overflow-hidden">
              {mobileTab === "timeline" ? (
                <Timeline entries={entries} partyStart={setStart} accessToken={session?.accessToken ?? ""} playedCount={playedTracks.length} onReorder={reorderTracks} queuedIds={queuedIds} compact />
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col">
                  <div className="px-4 py-3 text-xs text-zinc-500 uppercase tracking-widest border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950 z-10">
                    <span>{allTracks.length} song{allTracks.length !== 1 ? "s" : ""}</span>
                    <span className="flex items-center gap-1.5 text-[#1DB954] text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse" />
                      live
                    </span>
                  </div>
                  {playedTracks.map((track, i) => (
                    <div key={track.playId ?? "played-m-" + track.id + "-" + i} className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800/30 opacity-35">
                      <div className="min-w-0 flex-1">
                        <p className="text-zinc-400 text-sm font-medium truncate line-through">{track.name}</p>
                        <p className="text-zinc-600 text-xs truncate mt-0.5">{track.artists.join(", ")}</p>
                      </div>
                    </div>
                  ))}
                  {playedTracks.length > 0 && (
                    <div className="px-4 py-2 text-[10px] text-zinc-600 uppercase tracking-widest bg-zinc-900/60 border-b border-zinc-800">now playing</div>
                  )}
                  {tracks.map((track, i) => {
                    const isQueued = queuedIds.includes(track.playId);
                    return (
                      <div
                        key={track.playId ?? track.id + "-m-" + i}
                        className="slide-in-right flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800/50 active:bg-zinc-800/40"
                        style={{ animationDelay: isQueued ? "0ms" : `${Math.min(i * 20, 300)}ms`, opacity: 0, animationFillMode: "forwards" }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium truncate">{track.name}</p>
                            {isQueued && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1DB954]/20 text-[#1DB954] uppercase tracking-wide">queued</span>}
                          </div>
                          <p className="text-zinc-500 text-xs truncate mt-0.5">{track.artists.join(", ")}</p>
                        </div>
                        {i > 0 && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => moveTrack(i, -1)} disabled={i <= 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white disabled:opacity-20 active:bg-zinc-700 text-sm">↑</button>
                            <button onClick={() => moveTrack(i, 1)} disabled={i === tracks.length - 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white disabled:opacity-20 active:bg-zinc-700 text-sm">↓</button>
                            <button onClick={() => removeTrack(i)} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-400 active:bg-zinc-700 text-sm">✕</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden flex border-t border-zinc-800 bg-zinc-950 shrink-0">
        <button
          className={`relative flex-1 flex flex-col items-center py-3 gap-1 text-[11px] font-medium transition-colors ${mobileTab === "timeline" ? "text-white" : "text-zinc-500"}`}
          onClick={() => setMobileTab("timeline")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <span>Timeline</span>
          {mobileTab === "timeline" && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />}
        </button>
        <button
          className={`flex-1 flex flex-col items-center py-3 gap-1 text-[11px] font-medium transition-colors relative ${mobileTab === "queue" ? "text-white" : "text-zinc-500"}`}
          onClick={() => setMobileTab("queue")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span>Queue</span>
          {mobileTab === "queue" && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />}
        </button>
      </nav>
    </div>
  );
}
