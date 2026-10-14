import type { CSSProperties, ReactNode } from "react";
import { panelClass } from "@/lib/display/theme";
import type { PanelStyle } from "@/lib/display/config";

// Glass surface: real-time refraction of whatever is behind it via
// backdrop-filter (blur + saturate) plus an SVG displacement filter (#lgDistort)
// for the wobbly "liquid" edges. `panel` picks the treatment (liquid, frosted,
// solid, none); liquid degrades to frosted where url() filters in
// backdrop-filter aren't supported.
export default function GlassPanel({
  children,
  className = "",
  style,
  panel = "liquid",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  panel?: PanelStyle;
}) {
  return (
    <div className={`${panelClass(panel)} ${className}`} style={style}>
      {children}
    </div>
  );
}
