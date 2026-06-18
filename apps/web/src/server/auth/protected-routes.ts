const protectedRoutePrefixes = [
  "/dashboard",
  "/workspace",
  "/result",
  "/history",
  "/admin"
];

export function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getSafeRedirectPath(
  redirectTo: string | string[] | undefined,
  fallback = "/dashboard"
) {
  const requestedPath = Array.isArray(redirectTo) ? redirectTo[0] : redirectTo;

  if (!requestedPath || !requestedPath.startsWith("/")) {
    return fallback;
  }

  if (requestedPath.startsWith("//")) {
    return fallback;
  }

  return requestedPath;
}

export function getLoginRedirectUrl(requestUrl: URL) {
  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set(
    "redirectTo",
    `${requestUrl.pathname}${requestUrl.search}`
  );

  return loginUrl;
}
