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
  { id: "solid", name: "Solid", motion: "still", hint: "Just the theme color. Lightest on any TV." },
  { id: "billboard", name: "Billboard city", motion: "still", hint: "A still night skyline with a lit billboard. The billboard takes over as the now-playing display: cover and song, or the lyric line." },
  { id: "image", name: "Your image", motion: "still", hint: "Any image or GIF link, blurred and tinted." },
  { id: "soft", name: "Soft gradient", motion: "calm", hint: "The cover's colors as slow, drifting light. No 3D work." },
  { id: "cover", name: "Blurred cover", motion: "calm", hint: "The album cover itself, blurred and slowly drifting." },
  { id: "bokeh", name: "City lights", motion: "calm", hint: "Out-of-focus lights drifting up, like a skyline through a rainy window.", speed: true },
  { id: "vinyl", name: "Vinyl", motion: "calm", hint: "A record spinning with the cover as its label. Stops when paused.", speed: true },
  { id: "shader", name: "3D gradient", motion: "lively", hint: "The original moving gradient. Heaviest on weak TVs.", speed: true },
  { id: "city", name: "Night city", motion: "lively", hint: "Skyline with windows lit in the cover's colors, a passing train and traffic.", speed: true },
  { id: "synthwave", name: "Synthwave", motion: "lively", hint: "Retro sunset over a neon grid rolling toward you.", speed: true },
  { id: "stars", name: "Starfield", motion: "lively", hint: "Flying through stars tinted by the cover.", speed: true },
];

export const MOTION_LABEL: Record<Motion, string> = { still: "Still", calm: "Calm", lively: "Lively" };

export const backgroundInfo = (id: BackgroundType) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
