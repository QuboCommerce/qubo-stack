"use client";

import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
      onClick={async () => {
        await signOut();
        window.location.assign("/sign-in");
      }}
      type="button"
    >
      Déconnexion
    </button>
  );
}
