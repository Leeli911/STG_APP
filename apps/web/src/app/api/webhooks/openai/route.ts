import { randomUUID } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import { createBackgroundAiRuntime } from "@/server/ai/backgroundRuntime";
import { processOpenAiWebhook } from "@/server/ai/jobs";
import { createOpenAiWebhookVerifier } from "@/server/ai/openaiClient";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const webhookSecret = process.env.OPENAI_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return jsonError(
      "SERVER_CONFIGURATION_ERROR",
      "OpenAI webhook is not configured.",
      requestId,
      500
    );
  }

  try {
    const runtimeDependencies = createBackgroundAiRuntime();
    const outcome = await processOpenAiWebhook(
      await request.text(),
      request.headers,
      {
        verifier: createOpenAiWebhookVerifier({
          apiKey: runtimeDependencies.config.apiKey ?? "",
          webhookSecret
        }),
        repository: runtimeDependencies.jobRepository,
        provider: runtimeDependencies.aiClient,
        resultHandler: runtimeDependencies.pipeline.resultHandler
      }
    );
    return jsonSuccess({ outcome }, requestId);
  } catch (error) {
    const invalidSignature =
      error instanceof Error && /signature|webhook/i.test(error.message);
    return jsonError(
      invalidSignature ? "INVALID_WEBHOOK_SIGNATURE" : "WEBHOOK_PROCESSING_FAILED",
      invalidSignature
        ? "Webhook signature validation failed."
        : "Webhook processing failed.",
      requestId,
      invalidSignature ? 400 : 500
    );
  }
}
