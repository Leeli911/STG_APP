import { cookies } from "next/headers";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  DEV_AUTH_COOKIE_NAME,
  getDevAuthUserFromCookie
} from "@/server/auth/dev-auth";

export async function getCurrentUser() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return user;
  } catch {
    const cookieStore = await cookies();

    return getDevAuthUserFromCookie(
      cookieStore.get(DEV_AUTH_COOKIE_NAME)?.value
    );
  }
}
