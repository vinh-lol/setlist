import type { CSSProperties, ReactNode } from "react";

// Liquid-glass surface: real-time refraction of whatever is behind it via
// backdrop-filter (blur + saturate) plus an SVG displacement filter (#lgDistort)
// for the wobbly "liquid" edges. Degrades to a frosted panel where url() filters
// in backdrop-filter aren't supported.
export default function GlassPanel({
  children,
  className = "",
  style,
  distort = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  distort?: boolean;
}) {
  return (
    <div className={`lg-panel ${distort ? "lg-distort" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}
