import { randomUUID } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import {
  authenticateTrainingSessionRequest,
  isUuid,
  trainingSessionApiError,
  type TrainingSessionApiDependencies
} from "@/server/training-sessions/trainingSessionApiShared";

export type GetTrainingSessionApiDependencies = TrainingSessionApiDependencies;

export async function handleGetTrainingSession(
  request: Request,
  dependencies: GetTrainingSessionApiDependencies
) {
  const requestId = randomUUID();
  const auth = await authenticateTrainingSessionRequest(dependencies, requestId);
  if (!auth.ok) return auth.response;

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

  try {
    const session = await dependencies.service.getSession(
      auth.user.id,
      sessionId
    );
    return jsonSuccess({ session }, requestId);
  } catch (error) {
    return trainingSessionApiError(
      error,
      requestId,
      "Unable to load training session."
    );
  }
}

function readSessionId(url: URL) {
  const match = url.pathname.match(/\/api\/training-sessions\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
