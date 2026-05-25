"use client";

import { useEffect, useState } from "react";
import { getNowOffsetPx } from "@/lib/timeline";

export function useNowPosition(partyStart: Date): number | null {
  const [nowPx, setNowPx] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowPx(getNowOffsetPx(partyStart));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [partyStart]);

  return nowPx;
}
