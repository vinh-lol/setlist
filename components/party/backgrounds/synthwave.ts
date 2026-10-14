// Retro sunset: striped sun over two mountain ridges and a neon grid floor
// rolling toward the viewer. Sun, grid and sky all come from the cover colors.

import { glow, seeded, tone } from "./color";
import type { Scene } from "./CanvasScene";

interface State { ridges: number[][]; stars: { x: number; y: number; r: number }[] }

export const synthwaveScene: Scene<State> = {
  create(w, h) {
    const rand = seeded(7);
    const ridge = (n: number, amp: number) => Array.from({ length: n + 1 }, () => rand() * amp);
    return {
      ridges: [ridge(14, 0.12), ridge(22, 0.07)],
      stars: Array.from({ length: 90 }, () => ({ x: rand() * w, y: rand() * h * 0.45, r: rand() * 1.4 + 0.3 })),
    };
  },
  draw(ctx, w, h, t, p, s) {
    const hz = h * 0.62; // horizon
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, tone(p.c1, 6, 0.9));
    sky.addColorStop(1, tone(p.c3, 26, 1.1));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hz);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (const st of s.stars) ctx.fillRect(st.x, st.y, st.r, st.r);

    // Sun with horizontal slits that thicken toward the horizon
    const r = h * 0.2, cx = w / 2, cy = hz - r * 0.35;
    const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    sun.addColorStop(0, glow(p.accent, 1, 68, 80));
    sun.addColorStop(1, glow(p.c2, 1, 50, 62));
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = sun;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = tone(p.c3, 22, 1.1);
    for (let i = 0; i < 7; i++) {
      const y = cy + r * (0.05 + i * 0.14);
      ctx.fillRect(cx - r, y, r * 2, 2 + i * 1.6);
    }
    ctx.restore();

    // Mountain ridges
    s.ridges.forEach((rg, i) => {
      ctx.fillStyle = tone(p.c1, i === 0 ? 12 : 8, 0.6);
      ctx.beginPath();
      ctx.moveTo(0, hz);
      rg.forEach((v, k) => ctx.lineTo((k / (rg.length - 1)) * w, hz - h * (0.03 + v)));
      ctx.lineTo(w, hz);
      ctx.fill();
    });

    // Floor + grid
    ctx.fillStyle = tone(p.c1, 5, 0.8);
    ctx.fillRect(0, hz, w, h - hz);
    ctx.strokeStyle = glow(p.c2, 0.75, 55, 68);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = -14; i <= 14; i++) {
      ctx.moveTo(cx + i * 6, hz);
      ctx.lineTo(cx + i * w * 0.14, h);
    }
    const phase = (t * 0.35) % 1;
    for (let i = 0; i < 14; i++) {
      const z = (i + phase) / 14;
      const y = hz + (h - hz) * z * z;
      ctx.moveTo(0, y); ctx.lineTo(w, y);
    }
    ctx.stroke();
    // Haze over the horizon line
    const haze = ctx.createLinearGradient(0, hz - 30, 0, hz + 40);
    haze.addColorStop(0, "rgba(0,0,0,0)");
    haze.addColorStop(0.5, glow(p.accent, 0.25));
    haze.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, hz - 30, w, 70);
  },
};
