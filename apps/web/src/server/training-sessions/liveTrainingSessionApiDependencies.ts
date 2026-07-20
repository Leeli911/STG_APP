import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { createSupabaseAttemptRepository } from "@/server/attempts";
import type { SupabaseAttemptClient } from "@/server/attempts/attemptRepository";
import {
  createSupabaseTrainingSessionRepository,
  type SupabaseTrainingSessionClient
} from "@/server/training-sessions/trainingSessionRepository";
import { createTrainingSessionService } from "@/server/training-sessions/trainingSessionService";
import {
  createProfileContextResolver,
  type SupabaseProfileContextClient
} from "@/server/profiles";
import {
  createProductEventRecorder,
  type ProductEventRpcClient
} from "@/server/product-events";
import { getAiRuntimeConfig } from "@/server/ai/config";
import { createBackgroundAiRuntime } from "@/server/ai/backgroundRuntime";

export async function createLiveTrainingSessionApiDependencies() {
  const supabase = await createServerSupabaseClient();
  const authoritativeSupabase = createServiceRoleSupabaseClient();
  const attemptRepository = createSupabaseAttemptRepository(
    authoritativeSupabase as unknown as SupabaseAttemptClient
  );
  const sessionRepository = createSupabaseTrainingSessionRepository(
    supabase as unknown as SupabaseTrainingSessionClient
  );
  const aiConfig = getAiRuntimeConfig();
  const backgroundRuntime =
    aiConfig.mode === "live" && aiConfig.executionMode === "background"
      ? createBackgroundAiRuntime()
      : null;

  return {
    async getUser() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      return user ? { id: user.id } : null;
    },
    service: createTrainingSessionService({
      sessionRepository,
      attemptRepository,
      profileContextResolver: createProfileContextResolver(
        supabase as unknown as SupabaseProfileContextClient
      ),
      recordProductEvent: createProductEventRecorder(
        authoritativeSupabase as unknown as ProductEventRpcClient
      ),
      processRescoreAttempt: backgroundRuntime
        ? async (input) =>
            backgroundRuntime.pipeline.enqueueRescore({
              userId: input.userId,
              attempt: input.attempt,
              question: input.question,
              profileContext: input.profileContext
            })
        : undefined,
      deferRescore: Boolean(backgroundRuntime)
    })
  };
}
