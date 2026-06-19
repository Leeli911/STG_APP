"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  DEV_AUTH_COOKIE_NAME,
  DEV_AUTH_COOKIE_VALUE,
  getDevAuthCookieOptions,
  isDevAuthCredential
} from "@/server/auth/dev-auth";
import { getSafeRedirectPath } from "@/server/auth/protected-routes";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = getSafeRedirectPath(
    String(formData.get("redirectTo") ?? "/dashboard")
  );

  const supabase = await createSupabaseOrSignInDevUser(
    email,
    password,
    redirectTo
  );

  let error: unknown;

  try {
    ({ error } = await supabase.auth.signInWithPassword({
      email,
      password
    }));
  } catch {
    redirectToLogin(redirectTo, "auth_unavailable");
  }

  if (error) {
    redirectToLogin(redirectTo, "invalid_credentials");
  }

  redirect(redirectTo);
}

async function createSupabaseOrSignInDevUser(
  email: string,
  password: string,
  redirectTo: string
): Promise<Awaited<ReturnType<typeof createServerSupabaseClient>>> {
  try {
    return await createServerSupabaseClient();
  } catch {
    return signInDevUserOrRedirect(email, password, redirectTo);
  }
}

async function signInDevUserOrRedirect(
  email: string,
  password: string,
  redirectTo: string
): Promise<never> {
  if (!isDevAuthCredential(email, password)) {
    redirectToLogin(redirectTo, "auth_unavailable");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    DEV_AUTH_COOKIE_NAME,
    DEV_AUTH_COOKIE_VALUE,
    getDevAuthCookieOptions()
  );

  redirect(redirectTo);
}

function redirectToLogin(redirectTo: string, error: string): never {
  const loginUrl = new URL("/login", "http://localhost");
  loginUrl.searchParams.set("redirectTo", redirectTo);
  loginUrl.searchParams.set("error", error);
  redirect(`${loginUrl.pathname}${loginUrl.search}`);
}
