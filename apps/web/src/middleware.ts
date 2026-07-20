import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import {
  getLoginRedirectUrl,
  getSafeRedirectPath,
  isProtectedRoute,
  shouldUpdateAuthSession
} from "@/server/auth/protected-routes";
import { isMutationOriginAllowed } from "@/server/security/mutationOrigin";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    !isMutationOriginAllowed({
      method: request.method,
      pathname,
      requestOrigin: request.nextUrl.origin,
      originHeader: request.headers.get("origin"),
      secFetchSite: request.headers.get("sec-fetch-site")
    })
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_ORIGIN",
          message: "Cross-site mutation requests are not allowed."
        }
      },
      { status: 403 }
    );
  }

  // Public routes, including the deterministic demo, must not initialize
  // Supabase or make an authentication network request.
  if (!shouldUpdateAuthSession(pathname)) {
    return NextResponse.next({ request });
  }

  const { response, user } = await updateSession(request);

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

// Supabase's server client uses Node.js APIs. Next.js 15.5 supports the Node
// runtime for middleware, avoiding an Edge bundle with unsupported APIs.
export const runtime = "nodejs";
