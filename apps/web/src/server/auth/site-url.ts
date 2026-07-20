import { headers } from "next/headers";

export async function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return normalizeOrigin(configured);

  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");

  if (host) {
    const protocol = forwardedProtocol ?? (host.includes("localhost") ? "http" : "https");
    return normalizeOrigin(`${protocol}://${host}`);
  }

  return "http://localhost:3000";
}

function normalizeOrigin(value: string) {
  const url = new URL(value);
  return url.origin;
}
