"use client";

import { useRef } from "react";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";
import { useFrame, useThree } from "@react-three/fiber";
import { DEFAULT_CONFIG, type DisplayConfig } from "@/lib/display/config";

type ShaderSettings = DisplayConfig["background"]["shader"];

const SPEED_EASE_S = 0.4;

// The library animates with time = its own clock × uSpeed, so changing uSpeed
// rescales the whole timeline and the gradient jumps (and its clock is private,
// so it can't be paused cleanly). Instead its animation is turned off and this
// writes the shader's time uniform directly: time advances by delta × motion
// each frame, with motion easing toward the slider value, so speed changes and
// pausing pick up exactly where the gradient is.
function MotionClock({ motion }: { motion: number }) {
  const scene = useThree((s) => s.scene);
  const time = useRef(0);
  const cur = useRef(motion);
  useFrame((_, delta) => {
    const d = Math.min(0.1, delta);
    cur.current += (motion - cur.current) * Math.min(1, d / SPEED_EASE_S);
    if (Math.abs(motion - cur.current) < 0.002) cur.current = motion;
    time.current += d * cur.current;
    // The material is rebuilt when props change (e.g. a new song's colors), so
    // find it each frame; the scene is a single mesh, so this is cheap.
    scene.traverse((o: object) => {
      const u = (o as { material?: { userData?: { uTime?: { value: number } } } }).material?.userData?.uTime;
      if (u) u.value = time.current;
    });
  });
  return null;
}

// Full-screen animated gradient (ShaderGradient / three.js) coloured from the
// album cover. Client-only (rendered behind the dashboard via dynamic ssr:false).
// Shape and lighting come from the display config (background.shader); motion
// is the shared background speed (0 = paused, 1 = the original pace);
// camera and rotation stay fixed to the original framing.
export default function GradientBackground({
  colors,
  shader = DEFAULT_CONFIG.background.shader,
  motion = 1,
}: {
  colors: string[];
  shader?: ShaderSettings;
  motion?: number;
}) {
  const [c1, c2, c3] = colors;
  if (!c1) return null;

  return (
    <ShaderGradientCanvas
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <MotionClock motion={motion} />
      <ShaderGradient
        control="props"
        type={shader.shape}
        color1={c1}
        color2={c2 ?? c1}
        color3={c3 ?? c2 ?? c1}
        animate="off"
        uSpeed={shader.speed}
        uStrength={shader.strength}
        uDensity={shader.density}
        uFrequency={shader.frequency}
        cDistance={3.6}
        cPolarAngle={120}
        cAzimuthAngle={180}
        cameraZoom={1}
        positionX={0}
        positionY={0}
        positionZ={0}
        rotationX={50}
        rotationY={0}
        rotationZ={-60}
        grain={shader.grain ? "on" : "off"}
        lightType="3d"
        brightness={shader.brightness}
        reflection={0.1}
      />
    </ShaderGradientCanvas>
  );
}
