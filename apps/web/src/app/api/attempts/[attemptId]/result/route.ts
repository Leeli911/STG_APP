import { randomUUID } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { jsonError } from "@/server/api/envelope";
import {
  createDevAttemptRepository,
  createSupabaseAttemptRepository
} from "@/server/attempts";
import { handleGetAttemptResult } from "@/server/attempts/attemptResultApi";
import type { SupabaseAttemptClient } from "@/server/attempts/attemptRepository";
import { getDevAuthUserFromCookieHeader } from "@/server/auth/dev-auth";

export async function GET(request: Request) {
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    const devUser = getDevAuthUserFromCookieHeader(
      request.headers.get("cookie")
    );

    if (devUser) {
      return handleGetAttemptResult(request, {
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

  return handleGetAttemptResult(request, {
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
