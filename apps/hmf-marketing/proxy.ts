import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const protectedRoutes = ["/account", "/orders", "/settings"];
const authRoutes = ["/sign-in", "/sign-up"];

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => pathname.startsWith(route));
}

function isAuthRoute(pathname: string): boolean {
  return authRoutes.some((route) => pathname.startsWith(route));
}

function isAllowedDuringMaintenance(pathname: string): boolean {
  return (
    pathname === "/maintenance" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".webmanifest")
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Maintenance mode: check header set by edge config or a cookie-based flag
  // In production, the maintenance check reads from DB via lib/maintenance.ts
  // For middleware (edge), we use a simpler cookie/header approach
  const maintenanceHeader = req.headers.get("x-maintenance-mode");
  if (maintenanceHeader === "true" && !isAllowedDuringMaintenance(pathname)) {
    return NextResponse.redirect(new URL("/maintenance", req.url));
  }

  // Redirect away from maintenance page when not in maintenance
  if (pathname === "/maintenance" && maintenanceHeader !== "true") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Auth: redirect to sign-in if accessing protected routes without session
  if (isProtectedRoute(pathname)) {
    const sessionCookie = getSessionCookie(req);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  // Redirect away from auth pages if already logged in
  if (isAuthRoute(pathname)) {
    const sessionCookie = getSessionCookie(req);
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
