// Every background the display can use, with how much it moves. The settings
// gallery groups and filters by motion so you can pick "something calm" fast.

import type { BackgroundType } from "./config";

export type Motion = "still" | "calm" | "lively";

export interface BackgroundInfo {
  id: BackgroundType;
  name: string;
  motion: Motion;
  hint: string;
  /** Uses the motion speed setting. */
  speed?: boolean;
}

export const BACKGROUNDS: BackgroundInfo[] = [
  // still
  { id: "solid", name: "Solid", motion: "still", hint: "Just the theme color. Lightest on any TV." },
  { id: "fluted", name: "Fluted glass", motion: "still", hint: "The album cover seen through ribbed glass." },
  { id: "halftone", name: "Halftone", motion: "still", hint: "The album cover as a print-style dot pattern." },
  { id: "image", name: "Your image", motion: "still", hint: "Any image or GIF link, blurred and tinted." },
  // calm
  { id: "billboard", name: "Billboard city", motion: "calm", hint: "A lit billboard over the night city showing the cover and song, or the lyric line.", speed: true },
  { id: "aurora", name: "Aurora", motion: "calm", hint: "Northern lights in the cover's colors.", speed: true },
  { id: "silk", name: "Silk", motion: "calm", hint: "Slow-moving fabric with a sheen.", speed: true },
  { id: "rays", name: "Light rays", motion: "calm", hint: "A spotlight shining down from above.", speed: true },
  { id: "marble", name: "Marble", motion: "calm", hint: "Swirled bands of the cover's colors.", speed: true },
  { id: "lava", name: "Lava lamp", motion: "calm", hint: "Glowing blobs that drift and merge.", speed: true },
  { id: "soft", name: "Soft gradient", motion: "calm", hint: "The cover's colors as slow, drifting light. No 3D work." },
  { id: "cover", name: "Blurred cover", motion: "calm", hint: "The album cover itself, blurred and slowly drifting." },
  { id: "bokeh", name: "City lights", motion: "calm", hint: "Out-of-focus lights drifting up.", speed: true },
  { id: "vinyl", name: "Vinyl", motion: "calm", hint: "A record with the cover as its label. Stops when paused.", speed: true },
  // lively
  { id: "visualizer", name: "Visualizer", motion: "lively", hint: "Classic music visualizer that reacts to the room through a microphone, or to a built-in beat.", speed: true },
  { id: "drive", name: "Night drive", motion: "lively", hint: "Highway light trails at night.", speed: true },
  { id: "city", name: "Night city", motion: "lively", hint: "Skyline with lit windows, a passing train and traffic.", speed: true },
  { id: "galaxy", name: "Galaxy", motion: "lively", hint: "Flying through a twinkling galaxy.", speed: true },
  { id: "dither", name: "Retro dither", motion: "lively", hint: "Old-computer dot pattern in the cover's color.", speed: true },
  { id: "prism", name: "Prism burst", motion: "lively", hint: "Light bursting through a prism.", speed: true },
  { id: "chrome", name: "Liquid chrome", motion: "lively", hint: "Glossy liquid metal.", speed: true },
  { id: "shader", name: "3D gradient", motion: "lively", hint: "The original moving gradient. Heaviest on weak TVs.", speed: true },
  { id: "synthwave", name: "Synthwave", motion: "lively", hint: "Retro sunset over a rolling neon grid.", speed: true },
];

export const MOTION_LABEL: Record<Motion, string> = { still: "Still", calm: "Calm", lively: "Lively" };

export const backgroundInfo = (id: BackgroundType) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
