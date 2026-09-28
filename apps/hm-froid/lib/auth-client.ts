import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_MARKETING_URL || "http://localhost:3000",
});

export const { useSession, signIn, signUp, signOut } = authClient;
