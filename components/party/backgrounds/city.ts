// Night city: three skyline layers drifting at different speeds (parallax),
// windows lit in the cover's colors, stars, a moon, an elevated train every
// ~25s and traffic light streaks along the bottom. Original artwork, drawn
// from a seed so the skyline is the same every time.

import { glow, seeded, tone, type ScenePalette } from "./color";
import type { Scene } from "./CanvasScene";

interface Win { x: number; y: number; c: number; ph: number }
interface Building { x: number; w: number; h: number; wins: Win[]; roof: number }
interface Layer { buildings: Building[]; span: number; speed: number; base: number; shade: number; lit: number }
export interface CityState {
  layers: Layer[];
  stars: { x: number; y: number; r: number; ph: number }[];
  cars: { x: number; lane: number; len: number; v: number }[];
}

function makeLayer(rand: () => number, w: number, h: number, scale: number, minH: number, maxH: number, lit: number, speed: number, shade: number): Layer {
  const span = Math.max(w * 2, 2400);
  const buildings: Building[] = [];
  let x = 0;
  while (x < span) {
    const bw = Math.round((40 + rand() * 110) * scale);
    const bh = Math.round(h * (minH + rand() * (maxH - minH)));
    const wins: Win[] = [];
    const cell = Math.max(7, Math.round(12 * scale));
    for (let wy = h * 0.9 - bh + cell; wy < h * 0.9 - cell; wy += cell * 1.6) {
      for (let wx = x + cell * 0.6; wx < x + bw - cell; wx += cell * 1.3) {
        if (rand() < lit) wins.push({ x: wx, y: wy, c: Math.floor(rand() * 3), ph: rand() * Math.PI * 2 });
      }
    }
    buildings.push({ x, w: bw, h: bh, wins, roof: rand() < 0.25 ? Math.round(rand() * 22 * scale) : 0 });
    x += bw + Math.round(rand() * 6 * scale);
  }
  return { buildings, span: x, speed, base: h * 0.9, shade, lit };
}

export const cityScene: Scene<CityState> = {
  create(w, h) {
    const rand = seeded(42);
    return {
      layers: [
        makeLayer(rand, w, h, 0.7, 0.22, 0.42, 0.12, 5, 16),
        makeLayer(rand, w, h, 0.9, 0.28, 0.55, 0.22, 12, 11),
        makeLayer(rand, w, h, 1.2, 0.32, 0.66, 0.3, 26, 6),
      ],
      stars: Array.from({ length: 140 }, () => ({ x: rand() * w, y: rand() * h * 0.5, r: rand() * 1.2 + 0.3, ph: rand() * 6 })),
      cars: Array.from({ length: 14 }, (_, i) => ({ x: rand() * w, lane: i % 2, len: 30 + rand() * 50, v: 90 + rand() * 120 })),
    };
  },
  draw(ctx, w, h, t, p: ScenePalette, s, dt) {
    // Colors resolved once per frame (not per window): thousands of windows.
    const winCol = [p.c1, p.c2, p.c3].map((c) => glow(c, 1));
    const trainLit = glow(p.accent, 0.95);
    // Sky: always night, tinted by the cover
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.9);
    sky.addColorStop(0, tone(p.c1, 5, 0.8));
    sky.addColorStop(0.65, tone(p.c2, 12, 0.9));
    sky.addColorStop(1, tone(p.c3, 22, 1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    for (const st of s.stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 1.3 + st.ph)})`;
      ctx.fillRect(st.x, st.y, st.r, st.r);
    }
    // Moon with a halo
    const mx = w * 0.66, my = h * 0.1, mr = Math.min(w, h) * 0.035; // clear of the title column
    const halo = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 5);
    halo.addColorStop(0, glow(p.accent, 0.25, 70, 85));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    ctx.fillStyle = glow(p.accent, 1, 86, 92);
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();

    s.layers.forEach((L, li) => {
      const off = (t * L.speed) % L.span;
      const body = tone(p.c1, L.shade, 0.5);
      for (const rep of [0, 1]) {
        const dx = rep * L.span - off;
        for (const b of L.buildings) {
          const bx = b.x + dx;
          if (bx > w || bx + b.w < 0) continue;
          ctx.fillStyle = body;
          ctx.fillRect(bx, L.base - b.h, b.w, b.h);
          if (b.roof) ctx.fillRect(bx + b.w / 2 - 2, L.base - b.h - b.roof, 4, b.roof);
          const ws = li === 2 ? 5 : li === 1 ? 4 : 3;
          for (const wi of b.wins) {
            ctx.globalAlpha = (li === 0 ? 0.45 : 0.85) * (0.7 + 0.3 * Math.sin(t * 0.6 + wi.ph));
            ctx.fillStyle = winCol[wi.c];
            ctx.fillRect(wi.x + dx, wi.y, ws, ws + 1);
          }
          ctx.globalAlpha = 1;
        }
      }
      // Elevated train between the middle and front layers
      if (li === 1) {
        const ty = h * 0.74;
        ctx.fillStyle = tone(p.c1, 9, 0.4);
        ctx.fillRect(0, ty + 14, w, 4);
        const cycle = w + 1900;
        const tx = ((t * 150) % cycle) - 700;
        for (let c = 0; c < 6; c++) {
          const cx = tx + c * 104;
          if (cx > w || cx + 100 < 0) continue;
          ctx.fillStyle = tone(p.c2, 16, 0.4);
          ctx.fillRect(cx, ty, 100, 14);
          ctx.fillStyle = trainLit;
          for (let k = 0; k < 8; k++) {
            ctx.fillRect(cx + 6 + k * 12, ty + 4, 7, 5);
          }
        }
      }
    });

    // Street with light streaks
    ctx.fillStyle = tone(p.c1, 4, 0.4);
    ctx.fillRect(0, h * 0.9, w, h * 0.1);
    for (const car of s.cars) {
      car.x += (car.lane ? -1 : 1) * car.v * dt;
      if (car.x > w + 100) car.x = -car.len;
      if (car.x < -car.len - 100) car.x = w + car.len;
      const y = h * (car.lane ? 0.935 : 0.965);
      const g = ctx.createLinearGradient(car.x, 0, car.x + (car.lane ? car.len : -car.len), 0);
      const col = car.lane ? glow(p.accent, 0.9) : "rgba(255,244,214,0.9)";
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(car.x, car.x + (car.lane ? car.len : -car.len)), y, car.len, 3);
    }
  },
};
