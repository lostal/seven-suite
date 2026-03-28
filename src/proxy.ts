/**
 * Next.js Proxy
 *
 * Protects matched routes using Auth.js session state.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */

import { NextResponse } from "next/server";

import { ROUTES, getHomeRouteForRole } from "@/lib/constants";
import { auth } from "@/lib/auth/config";

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = !!request.auth;

  if (!isAuthenticated && pathname !== ROUTES.LOGIN) {
    const loginUrl = new URL(ROUTES.LOGIN, request.nextUrl.origin);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === ROUTES.LOGIN) {
    const role = request.auth?.user?.role;
    const homeUrl = new URL(getHomeRouteForRole(role), request.nextUrl.origin);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
