import { randomUUID } from "node:crypto";

import { jsonError } from "@/server/api/envelope";
import { handleGetTrainingSession } from "@/server/training-sessions/getTrainingSessionApi";
import { createLiveTrainingSessionApiDependencies } from "@/server/training-sessions/liveTrainingSessionApiDependencies";

export async function GET(request: Request) {
  try {
    return await handleGetTrainingSession(
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
