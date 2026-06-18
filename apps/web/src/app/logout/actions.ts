"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOutUser } from "@/server/auth/logout";

export async function logoutAction() {
  let redirectPath = "/login";

  try {
    const supabase = await createServerSupabaseClient();
    redirectPath = await signOutUser(supabase);
  } catch {
    redirectPath = "/login";
  }

  redirect(redirectPath);
}
