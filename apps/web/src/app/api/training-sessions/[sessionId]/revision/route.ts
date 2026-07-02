import { randomUUID } from "node:crypto";

import { jsonError } from "@/server/api/envelope";
import { handleCommitRevision } from "@/server/training-sessions/commitRevisionApi";
import { createLiveTrainingSessionApiDependencies } from "@/server/training-sessions/liveTrainingSessionApiDependencies";

export async function POST(request: Request) {
  try {
    return await handleCommitRevision(
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
