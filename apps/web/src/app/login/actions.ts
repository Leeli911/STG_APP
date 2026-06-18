"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/server/auth/protected-routes";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = getSafeRedirectPath(
    String(formData.get("redirectTo") ?? "/dashboard")
  );

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    redirectToLogin(redirectTo, "auth_unavailable");
  }

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

function redirectToLogin(redirectTo: string, error: string): never {
  const loginUrl = new URL("/login", "http://localhost");
  loginUrl.searchParams.set("redirectTo", redirectTo);
  loginUrl.searchParams.set("error", error);
  redirect(`${loginUrl.pathname}${loginUrl.search}`);
}
