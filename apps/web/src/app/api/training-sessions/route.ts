import { randomUUID } from "node:crypto";

import { jsonError } from "@/server/api/envelope";
import { handleCreateTrainingSession } from "@/server/training-sessions/createTrainingSessionApi";
import { createLiveTrainingSessionApiDependencies } from "@/server/training-sessions/liveTrainingSessionApiDependencies";

export async function POST(request: Request) {
  try {
    return await handleCreateTrainingSession(
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
