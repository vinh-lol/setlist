export interface SpotifyTrack {
  id: string;
  playId: string; // unique per queue slot — same song queued twice gets two different playIds
  name: string;
  artists: string[];
  duration_ms: number;
  albumName: string;
  albumArt: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl: string;
  trackCount: number;
}

export interface TrackColors {
  dominant: [number, number, number];
  palette: [number, number, number][];
}

export interface TimelineEntry {
  track: SpotifyTrack;
  startTime: Date;
  startMs: number;
  heightPx: number;
  offsetPx: number;
}
