"use client";

import { startSiteRuntime, type TransitionTheme } from "@qubo/blocks/runtime";
import { useEffect } from "react";

/** Effects, decor-on-view and page transitions for the rendered site (see `@qubo/blocks/runtime`). */
export function SiteRuntime({ theme }: { theme: TransitionTheme | undefined }) {
  useEffect(() => startSiteRuntime(window, theme), [theme]);
  return null;
}
