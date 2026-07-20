import { randomUUID } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import {
  AttemptServiceError,
  createAttemptService,
  type AttemptTrainingProgress
} from "@/server/attempts/attemptService";
import type { AttemptRepository } from "@/server/attempts/types";
import type { TrainingDayNumber } from "@/server/questions";
import type {
  PipelineInput,
  PipelineProfileContext
} from "@/server/ai/pipeline";
import type { AttemptRow } from "@/server/attempts/types";
import {
  recordProductEventBestEffort,
  type ProductEventRecorder
} from "@/server/product-events";

export type PostAttemptUser = {
  id: string;
};

export type PostAttemptDependencies = {
  getUser: () => Promise<PostAttemptUser | null>;
  repository: AttemptRepository;
  currentDayResolver?: (
    userId: string
  ) => Promise<TrainingDayNumber | AttemptTrainingProgress>;
  profileContextResolver?: (
    userId: string
  ) => Promise<PipelineProfileContext | undefined>;
  consumeAiQuota?: (userId: string, idempotencyKey: string) => Promise<{
    allowed: boolean;
    used: number;
    remaining: number;
    limit: number;
    resetsOn: string;
  }>;
  processAttempt?: (input: PipelineInput) => Promise<AttemptRow>;
  deferInFlightAttempts?: boolean;
  retryFailedAttempts?: boolean;
  recordProductEvent?: ProductEventRecorder;
};

type PostAttemptBody = {
  question_id?: unknown;
  answer_text?: unknown;
  client_started_at?: unknown;
};

export async function handlePostAttempt(
  request: Request,
  dependencies: PostAttemptDependencies
) {
  const requestId = randomUUID();
  let user: PostAttemptUser | null;

  try {
    user = await dependencies.getUser();
  } catch {
    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    );
  }

  if (!user) {
    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    );
  }

  const parsedBody = await parsePostAttemptBody(request);

  if (!parsedBody.ok) {
    return jsonError(
      "VALIDATION_ERROR",
      parsedBody.message,
      requestId,
      400,
      parsedBody.details
    );
  }

  const service = createAttemptService({
    repository: dependencies.repository,
    currentDayResolver: dependencies.currentDayResolver,
    profileContextResolver: dependencies.profileContextResolver,
    consumeAiQuota: dependencies.consumeAiQuota,
    processAttempt: dependencies.processAttempt,
    deferInFlightAttempts: dependencies.deferInFlightAttempts,
    retryFailedAttempts: dependencies.retryFailedAttempts
  });

  try {
    const attempt = await service.submitAttempt({
      userId: user.id,
      questionId: parsedBody.body.question_id,
      answerText: parsedBody.body.answer_text,
      clientStartedAt: parsedBody.body.client_started_at,
      idempotencyKey: request.headers.get("x-idempotency-key")
    });

    await recordProductEventBestEffort(
      dependencies.recordProductEvent,
      {
        userId: user.id,
        event_name: "draft_submitted",
        attempt_id: attempt.id,
        metadata: {
          practice_day: attempt.dayNumber,
          character_count: attempt.answerText.length,
          answer_language: detectAnswerLanguage(attempt.answerText)
        },
        request_id: requestId
      },
      "attempt.draft_submitted"
    );

    return jsonSuccess(
      { attempt },
      requestId,
      attempt.status === "completed" || attempt.status === "failed" ? 200 : 202
    );
  } catch (error) {
    if (error instanceof AttemptServiceError) {
      return jsonError(
        error.code,
        error.message,
        requestId,
        error.status,
        error.details
      );
    }

    return jsonError(
      "INTERNAL_ERROR",
      "Unable to submit answer.",
      requestId,
      500
    );
  }
}

function detectAnswerLanguage(answer: string): "zh" | "en" | "mixed" {
  const hasChinese = /[\u3400-\u9fff]/u.test(answer);
  const hasLatin = /[A-Za-z]/.test(answer);
  if (hasChinese && hasLatin) return "mixed";
  return hasChinese ? "zh" : "en";
}

async function parsePostAttemptBody(
  request: Request
): Promise<
  | {
      ok: true;
      body: PostAttemptBody;
    }
  | {
      ok: false;
      message: string;
      details: Record<string, unknown>;
    }
> {
  try {
    const body = (await request.json()) as unknown;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {
        ok: false,
        message: "Request body must be a JSON object.",
        details: {
          body: "object_required"
        }
      };
    }

    return {
      ok: true,
      body: body as PostAttemptBody
    };
  } catch {
    return {
      ok: false,
      message: "Request body must be valid JSON.",
      details: {
        body: "invalid_json"
      }
    };
  }
}
