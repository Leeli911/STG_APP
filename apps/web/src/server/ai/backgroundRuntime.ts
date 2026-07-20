import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { createBackgroundAiPipeline } from "@/server/ai/backgroundPipeline";
import { getAiRuntimeConfig } from "@/server/ai/config";
import {
  createSupabaseAiJobRepository,
  type SupabaseAiJobClient
} from "@/server/ai/jobs";
import { createOpenAiClient } from "@/server/ai/openaiClient";
import {
  createSupabaseAttemptRepository
} from "@/server/attempts";
import type { SupabaseAttemptClient } from "@/server/attempts/attemptRepository";
import {
  createProfileContextResolver,
  type SupabaseProfileContextClient
} from "@/server/profiles";

export function createBackgroundAiRuntime() {
  const config = getAiRuntimeConfig();
  if (config.mode !== "live" || config.executionMode !== "background") {
    throw new Error("Background AI runtime is not enabled.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const attemptRepository = createSupabaseAttemptRepository(
    supabase as unknown as SupabaseAttemptClient
  );
  const jobRepository = createSupabaseAiJobRepository(
    supabase as unknown as SupabaseAiJobClient
  );
  const aiClient = createOpenAiClient(config.apiKey ?? "");
  const pipeline = createBackgroundAiPipeline({
    attemptRepository,
    jobRepository,
    aiClient,
    model: config.model,
    timeoutMs: config.timeoutMs,
    profileContextResolver: createProfileContextResolver(
      supabase as unknown as SupabaseProfileContextClient
    )
  });

  return {
    config,
    aiClient,
    jobRepository,
    pipeline
  };
}
