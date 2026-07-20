const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const independentlyAuthenticatedMutationPrefixes = [
  "/api/webhooks/",
  "/api/cron/"
];

export type MutationOriginInput = {
  method?: string;
  pathname: string;
  requestOrigin: string;
  originHeader: string | null;
  secFetchSite: string | null;
};

/**
 * Reject browser cross-site mutations before authentication or business logic.
 * Signed webhooks and authenticated cron endpoints perform their own checks.
 */
export function isMutationOriginAllowed(input: MutationOriginInput) {
  if (safeMethods.has((input.method ?? "GET").toUpperCase())) return true;
  if (!input.pathname.startsWith("/api/")) return true;
  if (
    independentlyAuthenticatedMutationPrefixes.some((prefix) =>
      input.pathname.startsWith(prefix)
    )
  ) {
    return true;
  }

  if (input.secFetchSite?.toLowerCase() === "cross-site") return false;

  if (!input.originHeader) {
    // Non-browser clients generally omit both headers. Same-origin browser
    // navigations may also omit Origin, but still identify their fetch site.
    return (
      !input.secFetchSite ||
      input.secFetchSite === "same-origin" ||
      input.secFetchSite === "same-site" ||
      input.secFetchSite === "none"
    );
  }

  try {
    return new URL(input.originHeader).origin === input.requestOrigin;
  } catch {
    return false;
  }
}
