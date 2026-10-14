// Starfield: flying slowly through space, stars streaking past in the cover's
// colors. Speed follows the motion setting.

import { glow, seeded, tone } from "./color";
import type { Scene } from "./CanvasScene";

interface Star { x: number; y: number; z: number; c: number }

export const starsScene: Scene<{ stars: Star[]; rand: () => number }> = {
  create() {
    const rand = seeded(99);
    return { rand, stars: Array.from({ length: 420 }, () => ({ x: rand() * 2 - 1, y: rand() * 2 - 1, z: rand(), c: Math.floor(rand() * 3) })) };
  },
  draw(ctx, w, h, _t, p, s, dt) {
    const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    bg.addColorStop(0, tone(p.c2, 10, 0.8));
    bg.addColorStop(1, tone(p.c1, 3, 0.6));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const col = [p.c1, p.c2, p.c3].map((c) => glow(c, 1, 70, 85));
    const f = Math.min(w, h) * 0.6;
    ctx.lineCap = "round";
    for (const st of s.stars) {
      const z0 = st.z;
      st.z -= dt * 0.12;
      if (st.z <= 0.03) { st.x = s.rand() * 2 - 1; st.y = s.rand() * 2 - 1; st.z = 1; continue; }
      const x1 = w / 2 + (st.x / z0) * f, y1 = h / 2 + (st.y / z0) * f;
      const x2 = w / 2 + (st.x / st.z) * f, y2 = h / 2 + (st.y / st.z) * f;
      if (x2 < -20 || x2 > w + 20 || y2 < -20 || y2 > h + 20) { st.z = 1; continue; }
      ctx.globalAlpha = Math.min(1, (1 - st.z) * 1.4);
      ctx.strokeStyle = col[st.c];
      ctx.lineWidth = (1 - st.z) * 3 + 0.4;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 + 0.1, y2 + 0.1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};
