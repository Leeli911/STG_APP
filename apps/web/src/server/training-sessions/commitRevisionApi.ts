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

export type CommitRevisionApiDependencies = TrainingSessionApiDependencies;

export async function handleCommitRevision(
  request: Request,
  dependencies: CommitRevisionApiDependencies
) {
  const requestId = randomUUID();
  const auth = await authenticateTrainingSessionRequest(dependencies, requestId);
  if (!auth.ok) return auth.response;

  const key = readRequiredIdempotencyKey(request, requestId);
  if (!key.ok) return key.response;

  const sessionId = readSessionId(new URL(request.url));
  if (!isUuid(sessionId)) {
    return jsonError(
      "VALIDATION_ERROR",
      "session_id must be a valid UUID.",
      requestId,
      400,
      { field: "session_id" }
    );
  }

  const parsed = await readJsonObject(request, requestId);
  if (!parsed.ok) return parsed.response;

  if (
    Object.prototype.hasOwnProperty.call(parsed.body, "feedback_mode") ||
    Object.prototype.hasOwnProperty.call(parsed.body, "feedbackMode")
  ) {
    return jsonError(
      "VALIDATION_ERROR",
      "Feedback mode cannot be changed for a revision.",
      requestId,
      400,
      { field: "feedback_mode" }
    );
  }

  try {
    const result = await dependencies.service.commitRevision({
      userId: auth.user.id,
      sessionId,
      idempotencyKey: key.key,
      action: parsed.body.action,
      editedText: parsed.body.edited_text,
      clientDecidedAt: parsed.body.client_decided_at
    });
    return jsonSuccess({ session: result.session }, requestId, result.httpStatus);
  } catch (error) {
    return trainingSessionApiError(
      error,
      requestId,
      "Unable to commit revision."
    );
  }
}

function readSessionId(url: URL) {
  const match = url.pathname.match(
    /\/api\/training-sessions\/([^/]+)\/revision$/
  );
  return match ? decodeURIComponent(match[1]) : null;
}
