// Night city on the water. Three skyline layers drift at different speeds
// (parallax) with haze between them, so the far towers fade into the glow of
// the city. Buildings come in a few shapes (flat, stepped, spire with a
// blinking aircraft light, water tower) with windows on a real floor grid:
// whole floors lit like offices, a few windows switching on and off. Search
// beams sweep the sky, a plane crosses now and then, an elevated train runs
// between the layers, traffic streams along the waterfront and the whole
// skyline is mirrored in rippling water. Colors come from the cover.
// Original artwork, drawn from a seed so the skyline is the same every time.
//
// Performance: windows are batched into one path per color per layer (a few
// fill() calls instead of thousands), and the reflection is a handful of
// strips copied from the canvas itself.

import { glow, seeded, tone, type ScenePalette } from "./color";
import type { Scene } from "./CanvasScene";

type Kind = "flat" | "setback" | "spire" | "tower" | "slant";
interface Win { x: number; y: number; c: number; blink: number; ph: number }
interface Building {
  x: number; w: number; h: number; kind: Kind;
  step: number; // setback inset
  cap: number; // spire / tower height
  ph: number;
  neon: number; // -1 none, else palette index for a vertical neon strip
}
interface Layer {
  buildings: Building[];
  wins: Win[];
  span: number;
  speed: number;
  base: number;
  shade: number;
  ws: number; // window width
  wh: number;
  winAlpha: number;
}
export interface CityState {
  layers: Layer[];
  stars: { x: number; y: number; r: number; ph: number }[];
  cars: { x: number; lane: number; len: number; v: number }[];
  waterTop: number;
}

const KINDS: Kind[] = ["flat", "flat", "flat", "setback", "setback", "spire", "tower", "slant"];

function makeLayer(rand: () => number, w: number, h: number, o: {
  scale: number; minH: number; maxH: number; lit: number; speed: number; shade: number; base: number; detail: boolean; winAlpha: number;
}): Layer {
  const span = Math.max(w * 2, 2400);
  const buildings: Building[] = [];
  const wins: Win[] = [];
  const ws = Math.max(2, Math.round(4 * o.scale));
  const wh = Math.max(2, Math.round(5 * o.scale));
  const gx = ws + Math.max(2, Math.round(4 * o.scale));
  const gy = wh + Math.max(3, Math.round(6 * o.scale));
  let x = 0;
  while (x < span) {
    const bw = Math.round((50 + rand() * 120) * o.scale);
    const bh = Math.round(h * (o.minH + rand() * (o.maxH - o.minH)));
    const kind = o.detail ? KINDS[Math.floor(rand() * KINDS.length)] : rand() < 0.2 ? "spire" : "flat";
    const b: Building = {
      x, w: bw, h: bh, kind,
      step: kind === "setback" ? Math.round(bw * (0.14 + rand() * 0.12)) : 0,
      cap: kind === "spire" ? Math.round((30 + rand() * 50) * o.scale) : kind === "tower" ? Math.round(18 * o.scale) : 0,
      ph: rand() * 10,
      neon: o.detail && rand() < 0.18 ? Math.floor(rand() * 3) : -1,
    };
    buildings.push(b);
    // Windows on a floor grid. Each building has its own occupancy, and some
    // floors are lit edge to edge like an office still working late.
    const occupancy = o.lit * (0.4 + rand() * 1.2);
    const tint = rand() < 0.55 ? 3 : Math.floor(rand() * 3); // 3 = warm light, else a cover color
    const top = o.base - bh + gy * 0.8 + (kind === "slant" ? bw * 0.25 : 0);
    const pad = Math.max(3, Math.round(bw * 0.08));
    for (let wy = top; wy < o.base - gy; wy += gy) {
      const office = rand() < 0.05;
      const stepIn = b.step && wy < o.base - bh * 0.62 ? b.step : 0;
      for (let wx = x + pad + stepIn; wx < x + bw - pad - ws - stepIn; wx += gx) {
        if (office || rand() < occupancy) {
          wins.push({ x: wx, y: wy, c: rand() < 0.15 ? Math.floor(rand() * 4) : tint, blink: rand() < 0.04 ? 6 + rand() * 18 : 0, ph: rand() });
        }
      }
    }
    x += bw + Math.round(rand() * 5 * o.scale);
  }
  return { buildings, wins, span: x, speed: o.speed, base: o.base, shade: o.shade, ws, wh, winAlpha: o.winAlpha };
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, bx: number, base: number) {
  const top = base - b.h;
  switch (b.kind) {
    case "setback": {
      const upper = b.h * 0.38;
      ctx.fillRect(bx, top + upper, b.w, b.h - upper);
      ctx.fillRect(bx + b.step, top, b.w - b.step * 2, upper + 1);
      break;
    }
    case "slant":
      ctx.beginPath();
      ctx.moveTo(bx, top + b.w * 0.25);
      ctx.lineTo(bx + b.w, top);
      ctx.lineTo(bx + b.w, base);
      ctx.lineTo(bx, base);
      ctx.fill();
      break;
    case "spire":
      ctx.fillRect(bx, top, b.w, b.h);
      ctx.beginPath();
      ctx.moveTo(bx + b.w * 0.3, top);
      ctx.lineTo(bx + b.w / 2, top - b.cap);
      ctx.lineTo(bx + b.w * 0.7, top);
      ctx.fill();
      ctx.fillRect(bx + b.w / 2 - 1, top - b.cap * 1.35, 2, b.cap * 0.4);
      break;
    case "tower": {
      // a water tower on a short roof
      ctx.fillRect(bx, top, b.w, b.h);
      const tw = Math.min(26, b.w * 0.3);
      ctx.fillRect(bx + b.w * 0.25, top - b.cap * 0.5, 2, b.cap * 0.5);
      ctx.fillRect(bx + b.w * 0.25 + tw - 2, top - b.cap * 0.5, 2, b.cap * 0.5);
      ctx.fillRect(bx + b.w * 0.25, top - b.cap * 1.3, tw, b.cap * 0.8);
      break;
    }
    default:
      ctx.fillRect(bx, top, b.w, b.h);
  }
}

/**
 * moonX: where the moon sits (0..1 of the width).
 * drift: whether the skyline pans. Off keeps the buildings in place while
 * everything else (beams, train, traffic, water, lights) still moves.
 */
export function makeCityScene({ moonX = 0.66, seed = 42, drift = true }: { moonX?: number; seed?: number; drift?: boolean } = {}): Scene<CityState> {
  return {
    create(w, h) {
      const rand = seeded(seed);
      const base = h * 0.84;
      return {
        layers: [
          makeLayer(rand, w, h, { scale: 0.6, minH: 0.16, maxH: 0.42, lit: 0.08, speed: 4, shade: 14, base, detail: false, winAlpha: 0.35 }),
          makeLayer(rand, w, h, { scale: 0.85, minH: 0.14, maxH: 0.46, lit: 0.12, speed: 10, shade: 9, base, detail: true, winAlpha: 0.6 }),
          makeLayer(rand, w, h, { scale: 1.15, minH: 0.08, maxH: 0.4, lit: 0.12, speed: 22, shade: 5, base, detail: true, winAlpha: 0.85 }),
        ],
        stars: Array.from({ length: 110 }, () => ({ x: rand() * w, y: rand() * h * 0.42, r: rand() * 1.3 + 0.3, ph: rand() * 6 })),
        cars: Array.from({ length: 16 }, (_, i) => ({ x: rand() * w, lane: i % 2, len: 24 + rand() * 40, v: 70 + rand() * 110 })),
        waterTop: h * 0.86,
      };
    },
    draw(ctx, w, h, t, p: ScenePalette, s, dt) {
      const pal = [p.c1, p.c2, p.c3];
      // window colors: three cover colors and a warm white tinted by the accent
      const winCol = [...pal.map((c) => glow(c, 1, 62, 78)), tone(p.accent, 76, 0.45)];
      const horizon = s.layers[0].base - h * 0.2;

      // Sky: deep night at the top, the city's glow at the horizon
      const sky = ctx.createLinearGradient(0, 0, 0, s.waterTop);
      sky.addColorStop(0, tone(p.c1, 4, 0.7));
      sky.addColorStop(0.45, tone(p.c2, 9, 0.8));
      sky.addColorStop(0.85, tone(p.c3, 22, 0.9));
      sky.addColorStop(1, tone(p.accent, 30, 0.9));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, s.waterTop);

      for (const st of s.stars) {
        ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.3 * Math.sin(t * 1.1 + st.ph)})`;
        ctx.fillRect(st.x, st.y, st.r, st.r);
      }

      // Moon with a halo
      const mx = w * moonX, my = h * 0.11, mr = Math.min(w, h) * 0.034;
      const halo = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 6);
      halo.addColorStop(0, glow(p.accent, 0.22, 70, 85));
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
      ctx.fillStyle = tone(p.accent, 90, 0.3);
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = tone(p.accent, 80, 0.3, 0.5); // a few craters
      for (const [cx, cy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [0.35, -0.35, 0.1]]) {
        ctx.beginPath(); ctx.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, Math.PI * 2); ctx.fill();
      }

      // Search beams sweeping from behind the skyline
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const [bx, ph, c] of [[0.22, 0, p.c2], [0.58, 2.2, p.accent], [0.86, 4.1, p.c3]] as const) {
        const a = -Math.PI / 2 + Math.sin(t * 0.25 + ph) * 0.45;
        const ox = w * bx, oy = horizon + h * 0.12, len = h * 1.1, spread = 0.045;
        const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
        g.addColorStop(0, glow(c, 0.3, 65, 80));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(a - spread) * len, oy + Math.sin(a - spread) * len);
        ctx.lineTo(ox + Math.cos(a + spread) * len, oy + Math.sin(a + spread) * len);
        ctx.fill();
      }
      ctx.restore();

      // A plane crossing every ~45s, blinking
      const pc = (t % 45) / 45;
      if (pc < 0.6) {
        const px = -40 + (w + 80) * (pc / 0.6), py = h * 0.2 - pc * h * 0.06;
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(px, py, 2, 2);
        if ((t * 1.4) % 1 < 0.2) { ctx.fillStyle = "rgba(255,70,70,0.95)"; ctx.fillRect(px - 6, py + 1, 2, 2); }
      }

      s.layers.forEach((L, li) => {
        const off = drift ? (t * L.speed) % L.span : L.span * 0.3;
        const body = tone(p.c1, L.shade, 0.5);
        const rim = tone(p.c2, L.shade + 8, 0.6);
        ctx.fillStyle = body;
        for (const rep of [0, 1]) {
          const dx = rep * L.span - off;
          for (const b of L.buildings) {
            const bx = b.x + dx;
            if (bx > w || bx + b.w < 0) continue;
            drawBuilding(ctx, b, bx, L.base);
          }
        }
        // rim light on the left edges, neon strips and aircraft lights
        for (const rep of [0, 1]) {
          const dx = rep * L.span - off;
          for (const b of L.buildings) {
            const bx = b.x + dx;
            if (bx > w || bx + b.w < 0) continue;
            if (li > 0) {
              ctx.fillStyle = rim;
              const roof = b.kind === "slant" ? b.w * 0.25 : b.kind === "setback" ? b.h * 0.38 : 0;
              ctx.fillRect(bx, L.base - b.h + roof, 1.5, b.h - roof);
            }
            if (b.neon >= 0) {
              ctx.fillStyle = glow(pal[b.neon], 0.85, 60, 72);
              ctx.fillRect(bx + b.w - 6, L.base - b.h * 0.85, 2.5, b.h * 0.55);
            }
            if (b.kind === "spire" && ((t * 0.7 + b.ph) % 1) < 0.18) {
              ctx.fillStyle = "rgba(255,60,60,0.95)";
              ctx.beginPath(); ctx.arc(bx + b.w / 2, L.base - b.h - b.cap * 1.35, li ? 2.2 : 1.4, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
        // Windows: one path per color. A few windows switch on and off.
        ctx.globalAlpha = L.winAlpha;
        for (let c = 0; c < 4; c++) {
          ctx.beginPath();
          for (const wi of L.wins) {
            if (wi.c !== c) continue;
            if (wi.blink && ((t / wi.blink + wi.ph) % 1) < 0.35) continue;
            let x = wi.x - off;
            if (x < -L.ws) x += L.span;
            if (x > w) continue;
            ctx.rect(x, wi.y, L.ws, L.wh);
          }
          ctx.fillStyle = winCol[c];
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Haze in front of the far and middle layers
        if (li < 2) {
          const fog = ctx.createLinearGradient(0, L.base - h * 0.4, 0, L.base);
          fog.addColorStop(0, "rgba(0,0,0,0)");
          fog.addColorStop(1, tone(p.c3, 26, 0.8, li === 0 ? 0.55 : 0.35));
          ctx.fillStyle = fog;
          ctx.fillRect(0, L.base - h * 0.4, w, h * 0.4);
        }

        // Elevated train between the middle and front layers
        if (li === 1) {
          const ty = h * 0.7;
          ctx.fillStyle = tone(p.c1, 7, 0.4);
          ctx.fillRect(0, ty + 13, w, 4);
          const pillarOff = drift ? (t * L.speed) % 120 : 40;
          for (let px = -pillarOff; px < w; px += 120) ctx.fillRect(px, ty + 17, 5, L.base - ty);
          const cycle = w + 1900;
          const tx = ((t * 150) % cycle) - 700;
          for (let c = 0; c < 6; c++) {
            const cx = tx + c * 104;
            if (cx > w || cx + 100 < 0) continue;
            ctx.fillStyle = tone(p.c2, 14, 0.4);
            ctx.fillRect(cx, ty, 100, 13);
            ctx.fillStyle = glow(p.accent, 0.95, 70, 82);
            ctx.fillRect(cx + 4, ty + 4, 92, 4);
          }
          const hx = tx + 6 * 104 - 4;
          if (hx > -60 && hx < w + 60) { // headlight
            const hg = ctx.createRadialGradient(hx, ty + 6, 0, hx, ty + 6, 60);
            hg.addColorStop(0, "rgba(255,250,220,0.5)");
            hg.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = hg;
            ctx.fillRect(hx - 60, ty - 54, 120, 120);
          }
        }
      });

      // Waterfront road with traffic
      const road = s.layers[0].base;
      ctx.fillStyle = tone(p.c1, 3, 0.4);
      ctx.fillRect(0, road, w, s.waterTop - road);
      for (const car of s.cars) {
        car.x += (car.lane ? -1 : 1) * car.v * dt;
        if (car.x > w + 100) car.x = -car.len;
        if (car.x < -car.len - 100) car.x = w + car.len;
        const y = road + (s.waterTop - road) * (car.lane ? 0.3 : 0.65);
        const dir = car.lane ? 1 : -1;
        const g = ctx.createLinearGradient(car.x, 0, car.x + dir * car.len, 0);
        const col = car.lane ? "rgba(255,70,80,0.9)" : "rgba(255,244,214,0.95)";
        g.addColorStop(0, col);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(Math.min(car.x, car.x + dir * car.len), y, car.len, 2);
      }

      // Water: the skyline mirrored in strips that sway, then darkened.
      const wt = Math.round(s.waterTop), wh = h - wt;
      const strips = 18, sh = Math.ceil(wh / strips), squash = 0.75;
      for (let i = 0; i < strips; i++) {
        const dy = i * sh;
        const srcH = sh / squash;
        const srcY = wt - (dy + sh) / squash;
        if (srcY < 0) break;
        const sway = Math.sin(t * 1.6 + i * 0.8) * (1 + i * 0.35);
        ctx.save();
        ctx.translate(0, wt + dy + sh);
        ctx.scale(1, -1);
        ctx.drawImage(ctx.canvas, 0, srcY, w, srcH, sway, 0, w, sh);
        ctx.restore();
      }
      const water = ctx.createLinearGradient(0, wt, 0, h);
      water.addColorStop(0, tone(p.c1, 6, 0.6, 0.5));
      water.addColorStop(1, tone(p.c1, 3, 0.6, 0.85));
      ctx.fillStyle = water;
      ctx.fillRect(0, wt, w, wh);
      // glints
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let i = 0; i < 26; i++) {
        const gy = wt + 4 + ((i * 37) % wh);
        const gx = ((i * 211 + t * (12 + (i % 5) * 6)) % (w + 200)) - 100;
        ctx.fillRect(gx, gy, 40 + (i % 4) * 25, 1);
      }
    },
  };
}

export const cityScene = makeCityScene();
