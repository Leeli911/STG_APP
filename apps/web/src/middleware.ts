import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import {
  getLoginRedirectUrl,
  getSafeRedirectPath,
  isProtectedRoute
} from "@/server/auth/protected-routes";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  if (isProtectedRoute(pathname) && !user) {
    return NextResponse.redirect(getLoginRedirectUrl(request.nextUrl));
  }

  if (pathname === "/login" && user) {
    const redirectTo = getSafeRedirectPath(
      request.nextUrl.searchParams.get("redirectTo") ?? undefined
    );

    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
