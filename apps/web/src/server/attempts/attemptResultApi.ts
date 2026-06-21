import { randomUUID } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import {
  AttemptServiceError,
  createAttemptService
} from "@/server/attempts/attemptService";
import type { AttemptRepository } from "@/server/attempts/types";

export type GetAttemptResultUser = {
  id: string;
};

export type GetAttemptResultDependencies = {
  getUser: () => Promise<GetAttemptResultUser | null>;
  repository: AttemptRepository;
};

export async function handleGetAttemptResult(
  request: Request,
  dependencies: GetAttemptResultDependencies
) {
  const requestId = randomUUID();
  let user: GetAttemptResultUser | null;

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

  const attemptId = parseAttemptIdFromUrl(new URL(request.url));

  if (!attemptId) {
    return jsonError(
      "VALIDATION_ERROR",
      "attempt_id is required.",
      requestId,
      400
    );
  }

  const service = createAttemptService({
    repository: dependencies.repository
  });

  try {
    const result = await service.getAttemptResult(user.id, attemptId);
    return jsonSuccess({ result }, requestId);
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
      "Unable to load attempt result.",
      requestId,
      500
    );
  }
}

function parseAttemptIdFromUrl(url: URL) {
  const match = url.pathname.match(/\/api\/attempts\/([^/]+)\/result$/);
  return match ? decodeURIComponent(match[1]) : null;
}
