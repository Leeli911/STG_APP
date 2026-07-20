import { randomUUID } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import {
  authenticateTrainingSessionRequest,
  isUuid,
  trainingSessionApiError,
  type TrainingSessionApiDependencies
} from "@/server/training-sessions/trainingSessionApiShared";

export async function handleMarkFeedbackViewed(
  request: Request,
  dependencies: TrainingSessionApiDependencies
) {
  const requestId = randomUUID();
  const auth = await authenticateTrainingSessionRequest(dependencies, requestId);
  if (!auth.ok) return auth.response;

  const sessionId = parseSessionId(new URL(request.url));
  if (!isUuid(sessionId)) {
    return jsonError(
      "VALIDATION_ERROR",
      "session_id must be a valid UUID.",
      requestId,
      400
    );
  }

  try {
    const session = await dependencies.service.markFeedbackViewed(
      auth.user.id,
      sessionId
    );
    return jsonSuccess({ session }, requestId);
  } catch (error) {
    return trainingSessionApiError(
      error,
      requestId,
      "Unable to record feedback view."
    );
  }
}

function parseSessionId(url: URL) {
  const match = url.pathname.match(
    /\/api\/training-sessions\/([^/]+)\/viewed$/
  );
  return match ? decodeURIComponent(match[1]) : null;
}
