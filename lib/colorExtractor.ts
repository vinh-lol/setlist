import type { TrackColors } from "./types";

// Cache so we don't re-extract the same image twice
const cache = new Map<string, TrackColors>();

export async function extractColors(imageUrl: string): Promise<TrackColors> {
  if (!imageUrl) {
    return { dominant: [30, 30, 30], palette: [[50, 50, 50], [20, 20, 20]] };
  }

  if (cache.has(imageUrl)) return cache.get(imageUrl)!;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        // Dynamically import colorthief (browser-only)
        import("colorthief").then(({ default: ColorThief }) => {
          const thief = new ColorThief();
          const dominant = thief.getColor(img) as [number, number, number];
          const palette = (thief.getPalette(img, 3) ?? []) as [number, number, number][];
          const result: TrackColors = {
            dominant,
            palette: palette.length >= 2 ? palette : [dominant, [20, 20, 20]],
          };
          cache.set(imageUrl, result);
          resolve(result);
        }).catch(() => {
          resolve({ dominant: [30, 30, 30], palette: [[50, 50, 50], [20, 20, 20]] });
        });
      } catch {
        resolve({ dominant: [30, 30, 30], palette: [[50, 50, 50], [20, 20, 20]] });
      }
    };

    img.onerror = () => {
      resolve({ dominant: [30, 30, 30], palette: [[50, 50, 50], [20, 20, 20]] });
    };

    img.src = imageUrl;
  });
}

export function rgbToString(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function buildGradient(colors: TrackColors): string {
  const c1 = rgbToString(colors.palette[0] ?? colors.dominant);
  const c2 = rgbToString(colors.palette[1] ?? colors.dominant);
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
}

export function buildBorderColor(colors: TrackColors): string {
  return rgbToString(colors.dominant);
}
