import { randomUUID } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import {
  AttemptServiceError,
  createAttemptService
} from "@/server/attempts/attemptService";
import type { AttemptRepository } from "@/server/attempts/types";
import type { TrainingDayNumber } from "@/server/questions";

export type PostAttemptUser = {
  id: string;
};

export type PostAttemptDependencies = {
  getUser: () => Promise<PostAttemptUser | null>;
  repository: AttemptRepository;
  currentDayResolver?: (userId: string) => Promise<TrainingDayNumber>;
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
    currentDayResolver: dependencies.currentDayResolver
  });

  try {
    const attempt = await service.submitAttempt({
      userId: user.id,
      questionId: parsedBody.body.question_id,
      answerText: parsedBody.body.answer_text,
      clientStartedAt: parsedBody.body.client_started_at,
      idempotencyKey: request.headers.get("x-idempotency-key")
    });

    return jsonSuccess({ attempt }, requestId);
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
