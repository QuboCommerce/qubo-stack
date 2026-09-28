import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return NextResponse.redirect(new URL("/sign-in?error=missing", request.url));
  }

  const response = await fetch(
    new URL("/api/auth/sign-in/email", request.url),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, callbackURL: "/" }),
    },
  );

  if (!response.ok) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid", request.url));
  }

  const redirect = NextResponse.redirect(new URL("/", request.url));
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    redirect.headers.append("set-cookie", cookie);
  }
  return redirect;
}
