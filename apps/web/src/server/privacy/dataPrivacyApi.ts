import { randomUUID } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import { logger } from "@/server/observability/logger";
import type {
  DeleteTrainingDataResult,
  TrainingDataExport
} from "@/server/privacy/dataPrivacyRepository";

type PrivacyUser = { id: string };

export type DataPrivacyApiDependencies = {
  getUser(): Promise<PrivacyUser | null>;
  loadTrainingData(userId: string): Promise<TrainingDataExport>;
  deleteOwnTrainingData(userId: string): Promise<DeleteTrainingDataResult>;
  signOut(): Promise<void>;
};

export async function handleGetTrainingDataExport(
  dependencies: DataPrivacyApiDependencies
) {
  const requestId = randomUUID();
  const user = await readUser(dependencies);
  if (!user) {
    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    );
  }

  try {
    const exported = await dependencies.loadTrainingData(user.id);
    const response = jsonSuccess({ export: exported }, requestId);
    response.headers.set("cache-control", "no-store");
    response.headers.set(
      "content-disposition",
      `attachment; filename="stg-training-data-${exported.exportedAt.slice(0, 10)}.json"`
    );
    return response;
  } catch (error) {
    logger.error("Training-data export failed.", {
      requestId,
      route: "/api/me/export",
      error
    });
    return jsonError(
      "DATABASE_ERROR",
      "Unable to export training data.",
      requestId,
      500
    );
  }
}

export async function handleDeleteTrainingData(
  dependencies: DataPrivacyApiDependencies
) {
  const requestId = randomUUID();
  const user = await readUser(dependencies);
  if (!user) {
    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    );
  }

  let result: DeleteTrainingDataResult;
  try {
    result = await dependencies.deleteOwnTrainingData(user.id);
  } catch (error) {
    logger.error("Training-data deletion failed.", {
      requestId,
      route: "/api/me/data",
      error
    });
    return jsonError(
      "DATABASE_ERROR",
      "Unable to delete training data.",
      requestId,
      500
    );
  }

  try {
    await dependencies.signOut();
  } catch (error) {
    logger.error("Sign-out failed after training-data deletion.", {
      requestId,
      route: "/api/me/data",
      error
    });
    return jsonError(
      "DATA_DELETED_SIGN_OUT_FAILED",
      "Training data was deleted, but sign-out could not be confirmed.",
      requestId,
      500,
      { deleted: true }
    );
  }

  const response = jsonSuccess({ deletion: result, signedOut: true }, requestId);
  response.headers.set("cache-control", "no-store");
  response.headers.set("clear-site-data", '"cache", "storage"');
  return response;
}

async function readUser(dependencies: DataPrivacyApiDependencies) {
  try {
    return await dependencies.getUser();
  } catch {
    return null;
  }
}
