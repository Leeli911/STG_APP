import { randomUUID } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { jsonError } from "@/server/api/envelope";
import { getDevAuthUserFromCookieHeader } from "@/server/auth/dev-auth";
import {
  createDevAttemptRepository,
  createSupabaseAttemptRepository,
  handlePostAttempt
} from "@/server/attempts";
import type { SupabaseAttemptClient } from "@/server/attempts/attemptRepository";

export async function POST(request: Request) {
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    const devUser = getDevAuthUserFromCookieHeader(
      request.headers.get("cookie")
    );

    if (devUser) {
      return handlePostAttempt(request, {
        async getUser() {
          return {
            id: devUser.id
          };
        },
        repository: createDevAttemptRepository()
      });
    }

    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      randomUUID(),
      401
    );
  }

  return handlePostAttempt(request, {
    async getUser() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      return {
        id: user.id
      };
    },
    repository: createSupabaseAttemptRepository(
      supabase as unknown as SupabaseAttemptClient
    )
  });
}
