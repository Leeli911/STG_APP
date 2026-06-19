"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEV_AUTH_COOKIE_NAME } from "@/server/auth/dev-auth";
import { signOutUser } from "@/server/auth/logout";

export async function logoutAction() {
  let redirectPath = "/login";

  try {
    const supabase = await createServerSupabaseClient();
    redirectPath = await signOutUser(supabase);
  } catch {
    redirectPath = "/login";
  }

  await clearDevAuthCookie();
  redirect(redirectPath);
}

async function clearDevAuthCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(DEV_AUTH_COOKIE_NAME);
  } catch {
    // Logout should still land on the login page if cookie cleanup is unavailable.
  }
}
