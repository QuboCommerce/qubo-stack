import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Mirrors ADMIN_COOKIE_PREFIX in lib/auth.ts (not imported: that pulls in the DB).
const ADMIN_COOKIE_PREFIX = "qubo-admin";

// /api/me, /api/events and /api/presence check the session themselves and answer 401 (no HTML redirect for fetch/EventSource).
const publicRoutes = ["/sign-in", "/sign-up", "/api/auth", "/api/legacy-assets", "/api/media/", "/api/me", "/api/events", "/api/presence", "/api/studio/", "/robots.txt", "/manifest.webmanifest"];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname.startsWith(route));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(req, { cookiePrefix: ADMIN_COOKIE_PREFIX });

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
