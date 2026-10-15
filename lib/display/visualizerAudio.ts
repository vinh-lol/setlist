// Sound input for the Visualizer background. One shared AudioContext and mic
// stream for the whole page, so the background and the settings panel see the
// same state (the panel shows the status and has the "Allow microphone"
// button, which also counts as the user gesture browsers need to start audio).
//
// Spotify doesn't give apps the audio itself (and closed its beat/tempo
// analysis to new apps in Nov 2024), so the only way to react to the real
// music is to listen to the room through a microphone. Browsers only allow the
// mic on secure pages (https, or localhost), so a TV loading the app over the
// local network by IP falls back to the built-in beat.

export type MicStatus = "off" | "asking" | "listening" | "denied" | "insecure" | "unsupported";

interface State {
  status: MicStatus;
  node: AudioNode | null;
}

let ctx: AudioContext | null = null;
let stream: MediaStream | null = null;
let state: State = { status: "off", node: null };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export const getMicState = () => state;

/** WebGL2 + Web Audio, which Butterchurn needs. */
export function visualizerSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    return !!gl && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  } catch {
    return false;
  }
}

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    // Browsers start audio suspended until the page gets a click or key press.
    const resume = () => { ctx?.resume().catch(() => {}); };
    window.addEventListener("pointerdown", resume, { passive: true });
    window.addEventListener("keydown", resume);
  }
  return ctx;
}

export async function startMic(): Promise<MicStatus> {
  if (state.status === "listening") return state.status;
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) { set({ status: "insecure" }); return "insecure"; }
  if (!navigator.mediaDevices?.getUserMedia) { set({ status: "unsupported" }); return "unsupported"; }
  set({ status: "asking" });
  try {
    // Raw room sound: the voice-call cleanups would flatten the music.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ac = getAudioContext();
    await ac.resume().catch(() => {});
    set({ status: "listening", node: ac.createMediaStreamSource(stream) });
  } catch {
    set({ status: "denied", node: null });
  }
  return state.status;
}

export function stopMic() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  state.node?.disconnect();
  set({ status: "off", node: null });
}

/** Start the mic without a prompt if this site was already allowed to use it. */
export async function startMicIfAllowed() {
  if (state.status === "listening" || typeof navigator === "undefined" || !window.isSecureContext) return;
  try {
    const p = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    if (p?.state === "granted") await startMic();
  } catch {
    /* permissions API missing: wait for the button */
  }
}

// ---- built-in beat ---------------------------------------------------------
// A made-up 4/4 groove written straight into the waveform arrays Butterchurn
// reads (no audio is played): a kick on every beat, a snare-ish burst on 2 and
// 4, hats on the off-beats and a slow chord underneath.

const N = 1024;
const buf = { timeByteArray: new Uint8Array(N), timeByteArrayL: new Uint8Array(N), timeByteArrayR: new Uint8Array(N) };
let noiseSeed = 1;
const noise = () => { noiseSeed = (noiseSeed * 16807) % 2147483647; return noiseSeed / 1073741823.5 - 1; };

export function beatLevels(seconds: number, bpm = 118, sampleRate = 44100) {
  const beat = 60 / bpm;
  for (let i = 0; i < N; i++) {
    const t = seconds + i / sampleRate;
    const inBeat = t % beat; // time since the last beat
    const beatNo = Math.floor(t / beat);
    const half = (t + beat / 2) % beat; // time since the last off-beat
    const kick = Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-inBeat * 30)) * inBeat) * Math.exp(-inBeat * 7);
    const snare = beatNo % 2 === 1 ? noise() * Math.exp(-inBeat * 18) * 0.55 : 0;
    const hat = noise() * Math.exp(-half * 60) * 0.25;
    const chord = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277.2 * t) + Math.sin(2 * Math.PI * 329.6 * t)) * 0.06 * (0.6 + 0.4 * Math.sin(t * 0.5));
    const s = Math.max(-1, Math.min(1, kick * 0.85 + snare + hat + chord));
    const v = 128 + Math.round(s * 120);
    buf.timeByteArray[i] = v;
    buf.timeByteArrayL[i] = v;
    buf.timeByteArrayR[i] = 128 + Math.round(Math.max(-1, Math.min(1, s * 0.9 + hat * 0.3)) * 120);
  }
  return buf;
}
