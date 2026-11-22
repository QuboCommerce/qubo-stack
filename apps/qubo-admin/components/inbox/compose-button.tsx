"use client";

import { COMPOSE_EVENT, type ComposeDetail } from "@/components/inbox/use-inbox";
import { Button } from "@/components/ui/button";

/** Opens the composer below the thread in reply or note mode. */
export function ComposeButton({ mode, children, variant = "outline" }: { mode: ComposeDetail["mode"]; children: React.ReactNode; variant?: "outline" | "default" | "ghost" }) {
  return (
    <Button type="button" size="sm" variant={variant} onClick={() => window.dispatchEvent(new CustomEvent<ComposeDetail>(COMPOSE_EVENT, { detail: { mode } }))}>
      {children}
    </Button>
  );
}
