import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { NextRequest } from "next/server";

import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import LoginPage from "@/app/login/page";
import { middleware } from "@/middleware";
import { signOutUser } from "@/server/auth/logout";
import {
  getLoginRedirectUrl,
  isProtectedRoute
} from "@/server/auth/protected-routes";
import { getSupabasePublicEnv } from "@/lib/env/supabase";

function AuthProbe() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <p>Loading session</p>;
  }

  return <p>{user ? user.email : "No user"}</p>;
}

function createMiddlewareRequest(url: string): NextRequest {
  const requestUrl = new URL(url);

  return {
    headers: new Headers(),
    cookies: {
      getAll: () => [],
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
    expect(isProtectedRoute("/workspace")).toBe(true);
    expect(isProtectedRoute("/result/attempt-1")).toBe(true);
    expect(isProtectedRoute("/history")).toBe(true);
    expect(isProtectedRoute("/admin")).toBe(true);
    expect(isProtectedRoute("/login")).toBe(false);

    const redirectUrl = getLoginRedirectUrl(
      new URL("http://localhost:3000/dashboard?from=test")
    );

    expect(redirectUrl.pathname).toBe("/login");
    expect(redirectUrl.searchParams.get("redirectTo")).toBe(
      "/dashboard?from=test"
    );
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

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("/dashboard")).toHaveAttribute(
      "name",
      "redirectTo"
    );
  });

  it("renders a configuration error when login auth is unavailable", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          redirectTo: "/dashboard",
          error: "auth_unavailable"
        })
      })
    );

    expect(
      screen.getByText("Authentication is not configured for this environment.")
    ).toBeInTheDocument();
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
});
