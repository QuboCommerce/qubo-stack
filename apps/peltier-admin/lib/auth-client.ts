import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Use the browser origin so LAN, staging, and production hosts all work.
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_PANEL_URL || "http://localhost:4000",
});

export const { useSession, signIn, signUp, signOut } = authClient;
