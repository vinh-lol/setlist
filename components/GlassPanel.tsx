import type { CSSProperties, ReactNode } from "react";
import { panelClass } from "@/lib/display/theme";
import type { PanelStyle } from "@/lib/display/config";

// Glass surface: real-time blur of whatever is behind it via backdrop-filter.
// `panel` picks the treatment (glass, solid, none).
export default function GlassPanel({
  children,
  className = "",
  style,
  panel = "glass",
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
