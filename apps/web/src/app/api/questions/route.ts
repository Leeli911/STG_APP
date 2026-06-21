import { randomUUID } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDevAuthUserFromCookieHeader } from "@/server/auth/dev-auth";
import {
  createQuestionService,
  createStaticQuestionRepository,
  createSupabaseQuestionRepository
} from "@/server/questions";
import { jsonError } from "@/server/api/envelope";
import { handleGetQuestions } from "@/server/questions/questionApi";
import type { SupabaseLikeClient } from "@/server/questions/questionRepository";

export async function GET(request: Request) {
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    const devUser = getDevAuthUserFromCookieHeader(
      request.headers.get("cookie")
    );

    if (devUser) {
      return handleGetQuestions(request, {
        async getUser() {
          return {
            id: devUser.id
          };
        },
        questionService: createQuestionService(createStaticQuestionRepository())
      });
    }

    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      randomUUID(),
      401
    );
  }

  const questionService = createQuestionService(
    createSupabaseQuestionRepository(supabase as unknown as SupabaseLikeClient)
  );

  return handleGetQuestions(request, {
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
    questionService
  });
}
