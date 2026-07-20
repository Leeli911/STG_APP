import { randomUUID } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { jsonError } from "@/server/api/envelope";
import { getAiRuntimeConfig } from "@/server/ai/config";
import { createOpenAiClient } from "@/server/ai/openaiClient";
import { createBackgroundAiPipeline } from "@/server/ai/backgroundPipeline";
import {
  createSupabaseAiJobRepository,
  type SupabaseAiJobClient
} from "@/server/ai/jobs";
import { getDevAuthUserFromCookieHeader } from "@/server/auth/dev-auth";
import {
  createDevAttemptRepository,
  createSupabaseAttemptRepository,
  handlePostAttempt
} from "@/server/attempts";
import type { SupabaseAttemptClient } from "@/server/attempts/attemptRepository";
import {
  createSupabaseTrainingOverviewRepository,
  createTrainingOverviewService,
  type SupabaseTrainingOverviewClient
} from "@/server/training-overview";
import {
  createProfileContextResolver,
  type SupabaseProfileContextClient
} from "@/server/profiles";
import {
  createSupabaseAiQuotaConsumer,
  type SupabaseAiQuotaClient
} from "@/server/usage";
import {
  createProductEventRecorder,
  type ProductEventRpcClient
} from "@/server/product-events";

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

  let authoritativeSupabase: ReturnType<typeof createServiceRoleSupabaseClient>;
  let aiConfig: ReturnType<typeof getAiRuntimeConfig>;
  try {
    authoritativeSupabase = createServiceRoleSupabaseClient();
    aiConfig = getAiRuntimeConfig();
  } catch {
    return jsonError(
      "SERVER_CONFIGURATION_ERROR",
      "The training service is not configured.",
      randomUUID(),
      500
    );
  }

  const overviewService = createTrainingOverviewService(
    createSupabaseTrainingOverviewRepository(
      supabase as unknown as SupabaseTrainingOverviewClient
    )
  );
  const authoritativeAttemptRepository = createSupabaseAttemptRepository(
    authoritativeSupabase as unknown as SupabaseAttemptClient
  );
  const profileContextResolver = createProfileContextResolver(
    supabase as unknown as SupabaseProfileContextClient
  );
  const backgroundPipeline =
    aiConfig.mode === "live" && aiConfig.executionMode === "background"
      ? createBackgroundAiPipeline({
          attemptRepository: authoritativeAttemptRepository,
          jobRepository: createSupabaseAiJobRepository(
            authoritativeSupabase as unknown as SupabaseAiJobClient
          ),
          aiClient: createOpenAiClient(aiConfig.apiKey ?? ""),
          model: aiConfig.model,
          timeoutMs: aiConfig.timeoutMs,
          profileContextResolver
        })
      : null;

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
    repository: authoritativeAttemptRepository,
    currentDayResolver: async (userId) => overviewService.getProgress(userId),
    profileContextResolver,
    consumeAiQuota:
      aiConfig.mode === "live"
        ? createSupabaseAiQuotaConsumer(
            supabase as unknown as SupabaseAiQuotaClient
          )
        : undefined,
    recordProductEvent: createProductEventRecorder(
      authoritativeSupabase as unknown as ProductEventRpcClient
    ),
    processAttempt: backgroundPipeline
      ? async (input) =>
          backgroundPipeline.enqueueInitial({
            userId: input.userId,
            attempt: input.attempt,
            question: input.question,
            profileContext: input.profileContext
          })
      : undefined,
    deferInFlightAttempts: Boolean(backgroundPipeline)
  });
}
