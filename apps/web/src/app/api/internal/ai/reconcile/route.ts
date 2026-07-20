import { randomUUID, timingSafeEqual } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import { createBackgroundAiRuntime } from "@/server/ai/backgroundRuntime";
import { getAiRuntimeConfig } from "@/server/ai/config";
import { createAiJobReconcileService } from "@/server/ai/jobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleReconcile(request);
}

export async function POST(request: Request) {
  return handleReconcile(request);
}

async function handleReconcile(request: Request) {
  const requestId = randomUUID();
  if (!hasCronAuthorization(request)) {
    return jsonError("FORBIDDEN", "Cron authorization failed.", requestId, 403);
  }

  try {
    const config = getAiRuntimeConfig();
    if (config.mode !== "live" || config.executionMode !== "background") {
      return jsonSuccess(
        {
          outcome: "skipped",
          reason: "background_ai_disabled"
        },
        requestId
      );
    }

    const runtimeDependencies = createBackgroundAiRuntime();
    const service = createAiJobReconcileService({
      repository: runtimeDependencies.jobRepository,
      provider: runtimeDependencies.aiClient,
      resultHandler: runtimeDependencies.pipeline.resultHandler
    });
    const summary = await service.reconcile();
    return jsonSuccess({ summary }, requestId);
  } catch {
    return jsonError(
      "RECONCILE_FAILED",
      "AI job reconciliation failed.",
      requestId,
      500
    );
  }
}

function hasCronAuthorization(request: Request) {
  const expected =
    process.env.CRON_SECRET?.trim() || process.env.STG_CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}
