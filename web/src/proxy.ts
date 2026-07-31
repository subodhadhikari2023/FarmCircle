import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/grower", "/vendor", "/customer", "/admin"];

// Optimistic check only: confirms *a* session cookie is present, not that
// it's valid or which role it belongs to (the refreshToken JWT carries no
// role claim, and its secret isn't available here anyway). Real
// authentication and role enforcement happen client-side via RequireRole,
// which calls the API's /users/me.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !request.cookies.has("refreshToken")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/grower/:path*",
    "/vendor/:path*",
    "/customer/:path*",
    "/admin/:path*",
  ],
};
