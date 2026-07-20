import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { NextRequest } from "next/server";

import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import LoginPage from "@/app/login/page";
import { middleware } from "@/middleware";
import { signOutUser } from "@/server/auth/logout";
import {
  DEV_AUTH_COOKIE_NAME,
  DEV_AUTH_COOKIE_VALUE,
  getDevAuthUserFromCookie,
  isDevAuthCredential,
  isDevAuthEnabled
} from "@/server/auth/dev-auth";
import {
  getLoginRedirectUrl,
  isProtectedRoute,
  shouldUpdateAuthSession
} from "@/server/auth/protected-routes";
import { getSupabasePublicEnv } from "@/lib/env/supabase";

function AuthProbe() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <p>Loading session</p>;
  }

  return <p>{user ? user.email : "No user"}</p>;
}

function createMiddlewareRequest(
  url: string,
  cookieValues: Record<string, string> = {}
): NextRequest {
  const requestUrl = new URL(url);

  return {
    headers: new Headers(),
    cookies: {
      get: (name: string) =>
        cookieValues[name]
          ? {
              name,
              value: cookieValues[name]
            }
          : undefined,
      getAll: () =>
        Object.entries(cookieValues).map(([name, value]) => ({
          name,
          value
        })),
      set: vi.fn()
    },
    nextUrl: requestUrl,
    url
  } as unknown as NextRequest;
}

describe("Module 2 auth foundation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/supabase/server");
    vi.doUnmock("@/server/auth/session");
    vi.doUnmock("next/headers");
    vi.doUnmock("next/navigation");
    vi.resetModules();
  });

  it("reads Supabase public env with publishable key preferred over legacy anon key", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_live",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy_anon"
    };

    expect(getSupabasePublicEnv(env)).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_live"
    });
  });

  it("protects Sprint 1 app routes and redirects unauthenticated users to login", () => {
    expect(isProtectedRoute("/dashboard")).toBe(true);
    expect(isProtectedRoute("/onboarding")).toBe(true);
    expect(isProtectedRoute("/reset-password")).toBe(true);
    expect(isProtectedRoute("/workspace")).toBe(true);
    expect(isProtectedRoute("/training/attempt-1")).toBe(true);
    expect(isProtectedRoute("/result/attempt-1")).toBe(true);
    expect(isProtectedRoute("/history")).toBe(true);
    expect(isProtectedRoute("/admin")).toBe(true);
    expect(isProtectedRoute("/login")).toBe(false);
    expect(isProtectedRoute("/signup")).toBe(false);
    expect(isProtectedRoute("/forgot-password")).toBe(false);
    expect(isProtectedRoute("/auth/callback")).toBe(false);
    expect(shouldUpdateAuthSession("/login")).toBe(true);
    expect(shouldUpdateAuthSession("/training-demo")).toBe(false);
    expect(shouldUpdateAuthSession("/")).toBe(false);

    const redirectUrl = getLoginRedirectUrl(
      new URL("http://localhost:3000/dashboard?from=test")
    );

    expect(redirectUrl.pathname).toBe("/login");
    expect(redirectUrl.searchParams.get("redirectTo")).toBe(
      "/dashboard?from=test"
    );
  });

  it("bypasses auth initialization for the public deterministic demo", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://invalid.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "unused-public-key");

    const response = await middleware(
      createMiddlewareRequest("http://localhost:3000/training-demo")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("treats missing Supabase env as unauthenticated instead of crashing middleware", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await middleware(
      createMiddlewareRequest("http://localhost:3000/dashboard")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?redirectTo=%2Fdashboard"
    );
  });

  it("allows protected routes with the local dev auth cookie", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("STG_ENABLE_DEV_AUTH", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await middleware(
      createMiddlewareRequest("http://localhost:3000/dashboard", {
        [DEV_AUTH_COOKIE_NAME]: DEV_AUTH_COOKIE_VALUE
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps development auth disabled unless it is explicitly enabled", () => {
    expect(
      isDevAuthEnabled({ NODE_ENV: "development" })
    ).toBe(false);
    expect(
      isDevAuthCredential("test@123.com", "123", {
        NODE_ENV: "test",
        STG_ENABLE_DEV_AUTH: "false"
      })
    ).toBe(false);
    expect(
      getDevAuthUserFromCookie(DEV_AUTH_COOKIE_VALUE, {
        NODE_ENV: "development",
        STG_ENABLE_DEV_AUTH: "true"
      })
    ).toEqual({
      id: "dev-user-test-123",
      email: "test@123.com"
    });
  });

  it("never accepts development auth in production, even when flagged on", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STG_ENABLE_DEV_AUTH", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    expect(
      isDevAuthCredential("test@123.com", "123", {
        NODE_ENV: "production",
        STG_ENABLE_DEV_AUTH: "true"
      })
    ).toBe(false);
    expect(
      getDevAuthUserFromCookie(DEV_AUTH_COOKIE_VALUE, {
        NODE_ENV: "production",
        STG_ENABLE_DEV_AUTH: "true"
      })
    ).toBeNull();

    const response = await middleware(
      createMiddlewareRequest("http://localhost:3000/dashboard", {
        [DEV_AUTH_COOKIE_NAME]: DEV_AUTH_COOKIE_VALUE
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?redirectTo=%2Fdashboard"
    );
  });

  it("keeps the server session fallback fail-closed in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STG_ENABLE_DEV_AUTH", "true");
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: vi
        .fn()
        .mockRejectedValue(new Error("Supabase unavailable"))
    }));
    vi.doMock("next/headers", () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue({
          name: DEV_AUTH_COOKIE_NAME,
          value: DEV_AUTH_COOKIE_VALUE
        })
      })
    }));

    const { getCurrentUser } = await import("@/server/auth/session");

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("loads the persisted session into user context and listens for auth updates", async () => {
    let authCallback:
      | ((event: string, session: { user: { id: string; email: string } } | null) => void)
      | undefined;

    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: "user-1",
                email: "learner@example.com"
              }
            }
          }
        }),
        onAuthStateChange: vi.fn((callback) => {
          authCallback = callback;
          return {
            data: {
              subscription: {
                unsubscribe: vi.fn()
              }
            }
          };
        })
      }
    };

    render(
      <AuthProvider client={client}>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByText("Loading session")).toBeInTheDocument();
    expect(await screen.findByText("learner@example.com")).toBeInTheDocument();

    await act(async () => {
      authCallback?.("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(screen.getByText("No user")).toBeInTheDocument();
    });
  });

  it("renders as signed out when Supabase env is missing on the client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText("No user")).toBeInTheDocument();
  });

  it("renders a login page that preserves the requested redirect", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ redirectTo: "/dashboard" })
      })
    );

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("/dashboard")).toHaveAttribute(
      "name",
      "redirectTo"
    );
  });

  it("renders a development login hint when login auth fallback is enabled", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("STG_ENABLE_DEV_AUTH", "true");

    render(
      await LoginPage({
        searchParams: Promise.resolve({
          redirectTo: "/dashboard",
          error: "auth_unavailable"
        })
      })
    );

    expect(screen.getByText("Development login is enabled.")).toBeInTheDocument();
    expect(
      screen.queryByText("Authentication is not configured for this environment.")
    ).not.toBeInTheDocument();
  });

  it("redirects back to login instead of crashing when login auth is unavailable", async () => {
    const redirect = vi.fn((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });

    vi.doMock("next/navigation", () => ({
      redirect
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: vi
        .fn()
        .mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_URL"))
    }));

    const { loginAction } = await import("@/app/login/actions");
    const formData = new FormData();
    formData.set("email", "learner@example.com");
    formData.set("password", "password");
    formData.set("redirectTo", "/dashboard");

    await expect(loginAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/login?redirectTo=%2Fdashboard&error=auth_unavailable"
    );
    expect(redirect).toHaveBeenCalledWith(
      "/login?redirectTo=%2Fdashboard&error=auth_unavailable"
    );
  });

  it("signs in with the local dev account when Supabase auth is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("STG_ENABLE_DEV_AUTH", "true");

    const redirect = vi.fn((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });
    const setCookie = vi.fn();

    vi.doMock("next/navigation", () => ({
      redirect
    }));
    vi.doMock("next/headers", () => ({
      cookies: vi.fn().mockResolvedValue({
        set: setCookie
      })
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: vi
        .fn()
        .mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_URL"))
    }));

    const { loginAction } = await import("@/app/login/actions");
    const formData = new FormData();
    formData.set("email", "test@123.com");
    formData.set("password", "123");
    formData.set("redirectTo", "/dashboard");

    await expect(loginAction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard"
    );
    expect(setCookie).toHaveBeenCalledWith(
      DEV_AUTH_COOKIE_NAME,
      DEV_AUTH_COOKIE_VALUE,
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        sameSite: "lax"
      })
    );
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("signs the user out and returns the login redirect", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await expect(
      signOutUser({
        auth: {
          signOut
        }
      })
    ).resolves.toBe("/login");

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("redirects to login instead of crashing when logout auth is unavailable", async () => {
    const redirect = vi.fn((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });

    vi.doMock("next/navigation", () => ({
      redirect
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: vi
        .fn()
        .mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_URL"))
    }));

    const { logoutAction } = await import("@/app/logout/actions");

    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("clears the local dev auth cookie when logout auth is unavailable", async () => {
    const redirect = vi.fn((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });
    const deleteCookie = vi.fn();

    vi.doMock("next/navigation", () => ({
      redirect
    }));
    vi.doMock("next/headers", () => ({
      cookies: vi.fn().mockResolvedValue({
        delete: deleteCookie
      })
    }));
    vi.doMock("@/lib/supabase/server", () => ({
      createServerSupabaseClient: vi
        .fn()
        .mockRejectedValue(new Error("Missing NEXT_PUBLIC_SUPABASE_URL"))
    }));

    const { logoutAction } = await import("@/app/logout/actions");

    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(deleteCookie).toHaveBeenCalledWith(DEV_AUTH_COOKIE_NAME);
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
