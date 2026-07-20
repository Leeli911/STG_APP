import { randomUUID } from "node:crypto";

import { jsonError } from "@/server/api/envelope";
import { logger } from "@/server/observability/logger";
import { handleDeleteTrainingData } from "@/server/privacy";
import { createLiveDataPrivacyDependencies } from "@/server/privacy/liveDataPrivacyDependencies";

export async function DELETE() {
  try {
    return await handleDeleteTrainingData(
      await createLiveDataPrivacyDependencies()
    );
  } catch (error) {
    const requestId = randomUUID();
    logger.error("Training-data delete route initialization failed.", {
      requestId,
      route: "/api/me/data",
      error
    });
    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    );
  }
}
