"use client";

import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

// Full-screen animated gradient (ShaderGradient / three.js) coloured from the
// album cover. Client-only (rendered behind the dashboard via dynamic ssr:false).
export default function GradientBackground({ colors }: { colors: string[] }) {
  const [c1, c2, c3] = colors;
  if (!c1) return null;

  return (
    <ShaderGradientCanvas
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <ShaderGradient
        control="props"
        type="waterPlane"
        color1={c1}
        color2={c2 ?? c1}
        color3={c3 ?? c2 ?? c1}
        animate="on"
        uSpeed={0.3}
        uStrength={1.6}
        uDensity={1.5}
        uFrequency={5.5}
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
        grain="off"
        lightType="3d"
        brightness={1.1}
        reflection={0.1}
      />
    </ShaderGradientCanvas>
  );
}
