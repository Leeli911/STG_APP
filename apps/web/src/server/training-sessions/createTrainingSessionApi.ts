import { randomUUID } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import {
  authenticateTrainingSessionRequest,
  isUuid,
  readJsonObject,
  readRequiredIdempotencyKey,
  trainingSessionApiError,
  type TrainingSessionApiDependencies
} from "@/server/training-sessions/trainingSessionApiShared";

export type CreateTrainingSessionApiDependencies =
  TrainingSessionApiDependencies;

export async function handleCreateTrainingSession(
  request: Request,
  dependencies: CreateTrainingSessionApiDependencies
) {
  const requestId = randomUUID();
  const auth = await authenticateTrainingSessionRequest(dependencies, requestId);
  if (!auth.ok) return auth.response;

  const key = readRequiredIdempotencyKey(request, requestId);
  if (!key.ok) return key.response;

  const parsed = await readJsonObject(request, requestId);
  if (!parsed.ok) return parsed.response;

  if (Object.prototype.hasOwnProperty.call(parsed.body, "feedback_mode")) {
    return jsonError(
      "VALIDATION_ERROR",
      "feedback_mode is controlled by the server.",
      requestId,
      400,
      { field: "feedback_mode" }
    );
  }

  if (!isUuid(parsed.body.initial_attempt_id)) {
    return jsonError(
      "VALIDATION_ERROR",
      "initial_attempt_id must be a valid UUID.",
      requestId,
      400,
      { field: "initial_attempt_id" }
    );
  }

  try {
    const session = await dependencies.service.createSession({
      userId: auth.user.id,
      initialAttemptId: parsed.body.initial_attempt_id,
      idempotencyKey: key.key
    });
    return jsonSuccess({ session }, requestId);
  } catch (error) {
    return trainingSessionApiError(
      error,
      requestId,
      "Unable to create training session."
    );
  }
}
