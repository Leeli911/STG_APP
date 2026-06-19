import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicEnv } from "@/lib/env/supabase";
import {
  DEV_AUTH_COOKIE_NAME,
  getDevAuthUserFromCookie
} from "@/server/auth/dev-auth";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request
  });
  let url: string;
  let publishableKey: string;

  try {
    ({ url, publishableKey } = getSupabasePublicEnv());
  } catch {
    return {
      response,
      user: getDevUser(request)
    };
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return {
      response,
      user
    };
  } catch {
    return {
      response,
      user: getDevUser(request)
    };
  }
}

function getDevUser(request: NextRequest) {
  return getDevAuthUserFromCookie(
    request.cookies.get(DEV_AUTH_COOKIE_NAME)?.value
  );
}
