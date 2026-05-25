import { readFile } from "fs/promises";
import path from "path";
import ViewClient from "../ViewClient";
import type { SpotifyTrack } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data", "setlists");

export default async function ViewCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const safe = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

  try {
    const content = await readFile(path.join(DATA_DIR, `${safe}.json`), "utf-8");
    const { tracks, playedTracks, partyStartMs } = JSON.parse(content) as {
      tracks: SpotifyTrack[];
      playedTracks: SpotifyTrack[];
      partyStartMs: number;
    };
    return (
      <ViewClient
        code={safe}
        initialTracks={tracks}
        initialPlayedTracks={playedTracks ?? []}
        initialPartyStartMs={partyStartMs}
      />
    );
  } catch {
    return <ViewClient code={safe} initialTracks={[]} initialPlayedTracks={[]} initialPartyStartMs={Date.now()} error />;
  }
}
