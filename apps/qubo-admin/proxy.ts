import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const publicRoutes = ["/sign-in", "/sign-up", "/api/auth", "/api/legacy-assets"];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname.startsWith(route));
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(req);

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
