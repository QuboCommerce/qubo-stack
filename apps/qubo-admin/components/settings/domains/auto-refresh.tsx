"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders server data on an interval while the tab is visible. `everyMs` 0 disables it. */
export function AutoRefresh({ everyMs }: { everyMs: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!everyMs) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(t);
  }, [everyMs, router]);
  return null;
}
