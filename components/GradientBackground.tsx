"use client";

import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";
import { DEFAULT_CONFIG, type DisplayConfig } from "@/lib/display/config";

type ShaderSettings = DisplayConfig["background"]["shader"];

// Full-screen animated gradient (ShaderGradient / three.js) coloured from the
// album cover. Client-only (rendered behind the dashboard via dynamic ssr:false).
// Shape, motion and lighting come from the display config (background.shader);
// camera and rotation stay fixed to the original framing.
export default function GradientBackground({
  colors,
  shader = DEFAULT_CONFIG.background.shader,
}: {
  colors: string[];
  shader?: ShaderSettings;
}) {
  const [c1, c2, c3] = colors;
  if (!c1) return null;

  return (
    <ShaderGradientCanvas
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <ShaderGradient
        control="props"
        type={shader.shape}
        color1={c1}
        color2={c2 ?? c1}
        color3={c3 ?? c2 ?? c1}
        animate={shader.speed > 0 ? "on" : "off"}
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
