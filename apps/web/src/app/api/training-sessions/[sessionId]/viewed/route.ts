import { randomUUID } from "node:crypto";

import { jsonError } from "@/server/api/envelope";
import { createLiveTrainingSessionApiDependencies } from "@/server/training-sessions/liveTrainingSessionApiDependencies";
import { handleMarkFeedbackViewed } from "@/server/training-sessions/markFeedbackViewedApi";

export async function POST(request: Request) {
  try {
    return await handleMarkFeedbackViewed(
      request,
      await createLiveTrainingSessionApiDependencies()
    );
  } catch {
    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      randomUUID(),
      401
    );
  }
}
