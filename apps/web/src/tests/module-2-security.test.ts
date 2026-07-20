import {
  buildContentSecurityPolicy,
  buildSecurityHeaders
} from "../../next.config";
import { isAdminAccessAllowed } from "@/server/auth/admin";
import { isMutationOriginAllowed } from "@/server/security/mutationOrigin";

describe("Module 2 security baseline", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("next/navigation");
    vi.doUnmock("@/server/auth/session");
    vi.resetModules();
  });

  it("keeps admin access fail-closed in production", () => {
    const user = { id: "user-1" };

    expect(
      isAdminAccessAllowed(user, {
        NODE_ENV: "production",
        STG_ENABLE_DEV_ADMIN: "true"
      })
    ).toBe(false);
    expect(
      isAdminAccessAllowed(user, {
        NODE_ENV: "development",
        STG_ENABLE_DEV_ADMIN: "true"
      })
    ).toBe(true);
    expect(
      isAdminAccessAllowed(null, {
        NODE_ENV: "development",
        STG_ENABLE_DEV_ADMIN: "true"
      })
    ).toBe(false);
  });

  it("emits a production CSP and defense-in-depth response headers", () => {
    const csp = buildContentSecurityPolicy("production");
    const headers = buildSecurityHeaders("production");
    const headerMap = new Map(headers.map(({ key, value }) => [key, value]));

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Strict-Transport-Security")).toContain(
      "max-age=31536000"
    );
  });

  it("rejects cross-site browser mutations while leaving signed integrations independent", () => {
    const base = {
      method: "POST",
      requestOrigin: "https://stg.example.com",
      originHeader: "https://stg.example.com",
      secFetchSite: "same-origin"
    };

    expect(
      isMutationOriginAllowed({ ...base, pathname: "/api/attempts" })
    ).toBe(true);
    expect(
      isMutationOriginAllowed({
        ...base,
        pathname: "/api/attempts",
        originHeader: "https://attacker.example",
        secFetchSite: "cross-site"
      })
    ).toBe(false);
    expect(
      isMutationOriginAllowed({
        ...base,
        pathname: "/api/webhooks/openai",
        originHeader: null,
        secFetchSite: null
      })
    ).toBe(true);
    expect(
      isMutationOriginAllowed({
        ...base,
        method: "GET",
        pathname: "/api/history",
        originHeader: "https://attacker.example",
        secFetchSite: "cross-site"
      })
    ).toBe(true);
  });

  it("enforces the admin decision in the server page", async () => {
    const notFound = vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    vi.doMock("next/navigation", () => ({ notFound }));
    vi.doMock("@/server/auth/session", () => ({
      getCurrentUser: vi.fn().mockResolvedValue({ id: "user-1" })
    }));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STG_ENABLE_DEV_ADMIN", "true");

    const { default: AdminPage } = await import("@/app/admin/page");

    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
