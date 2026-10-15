// Bokeh: big out-of-focus city lights drifting slowly upward, like looking at
// a skyline through a rainy window. Calm.

import { glow, seeded, tone } from "./color";
import type { Scene } from "./CanvasScene";

interface Dot { x: number; y: number; r: number; c: number; v: number; ph: number }

export const bokehScene: Scene<{ dots: Dot[] }> = {
  create(w, h) {
    const rand = seeded(3);
    const base = Math.min(w, h);
    return { dots: Array.from({ length: 38 }, () => ({ x: rand() * w, y: rand() * h, r: base * (0.03 + rand() * 0.09), c: Math.floor(rand() * 4), v: 6 + rand() * 14, ph: rand() * 6 })) };
  },
  draw(ctx, w, h, t, p, s, dt) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, tone(p.c1, 6, 0.7));
    bg.addColorStop(1, tone(p.c2, 12, 0.8));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const cols = [p.c1, p.c2, p.c3, p.accent];
    ctx.globalCompositeOperation = "lighter";
    for (const d of s.dots) {
      d.y -= d.v * dt;
      if (d.y < -d.r) { d.y = h + d.r; }
      const x = d.x + Math.sin(t * 0.2 + d.ph) * 20;
      const g = ctx.createRadialGradient(x, d.y, 0, x, d.y, d.r);
      g.addColorStop(0, glow(cols[d.c], 0.42));
      g.addColorStop(0.7, glow(cols[d.c], 0.18));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  },
};
