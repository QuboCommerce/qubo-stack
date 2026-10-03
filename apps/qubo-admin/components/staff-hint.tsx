"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const FLAG = "qubo_staff_hint";

/** Refreshes the parent-domain `qubo_staff` hint once per browser session. */
export function StaffHint() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/sign-in") || sessionStorage.getItem(FLAG)) return;
    fetch("/api/staff-hint", { method: "POST", credentials: "include" })
      .then((r) => r.ok && sessionStorage.setItem(FLAG, "1"))
      .catch(() => {});
  }, [pathname]);
  return null;
}

/** Called on sign-out so storefronts stop showing the Edit pen. */
export async function clearStaffHint() {
  sessionStorage.removeItem(FLAG);
  await fetch("/api/staff-hint", { method: "DELETE", credentials: "include" }).catch(() => {});
}
