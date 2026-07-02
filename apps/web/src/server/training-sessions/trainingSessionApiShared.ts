import { jsonError } from "@/server/api/envelope";
import {
  TrainingSessionServiceError,
  type TrainingSessionService
} from "@/server/training-sessions/trainingSessionService";

export type TrainingSessionApiUser = {
  id: string;
};

export type TrainingSessionApiDependencies = {
  getUser: () => Promise<TrainingSessionApiUser | null>;
  service: TrainingSessionService;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function authenticateTrainingSessionRequest(
  dependencies: TrainingSessionApiDependencies,
  requestId: string
): Promise<
  | { ok: true; user: TrainingSessionApiUser }
  | { ok: false; response: Response }
> {
  try {
    const user = await dependencies.getUser();
    if (user) return { ok: true, user };
  } catch {
    // Authentication failures use the same public response as a missing user.
  }

  return {
    ok: false,
    response: jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    )
  };
}

export function readRequiredIdempotencyKey(
  request: Request,
  requestId: string
): { ok: true; key: string } | { ok: false; response: Response } {
  const key = request.headers.get("x-idempotency-key")?.trim();
  if (key) return { ok: true, key };

  return {
    ok: false,
    response: jsonError(
      "VALIDATION_ERROR",
      "X-Idempotency-Key header is required.",
      requestId,
      400,
      { header: "X-Idempotency-Key" }
    )
  };
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export async function readJsonObject(
  request: Request,
  requestId: string
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  try {
    const body = (await request.json()) as unknown;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return { ok: true, body: body as Record<string, unknown> };
    }

    return {
      ok: false,
      response: jsonError(
        "VALIDATION_ERROR",
        "Request body must be a JSON object.",
        requestId,
        400,
        { body: "object_required" }
      )
    };
  } catch {
    return {
      ok: false,
      response: jsonError(
        "VALIDATION_ERROR",
        "Request body must be valid JSON.",
        requestId,
        400,
        { body: "invalid_json" }
      )
    };
  }
}

export function trainingSessionApiError(
  error: unknown,
  requestId: string,
  fallbackMessage: string
) {
  if (!(error instanceof TrainingSessionServiceError)) {
    return jsonError("INTERNAL_ERROR", fallbackMessage, requestId, 500);
  }

  if (
    error.code === "DATABASE_ERROR" ||
    error.code === "SESSION_DATA_INCOMPLETE"
  ) {
    return jsonError(
      "INTERNAL_ERROR",
      fallbackMessage,
      requestId,
      500
    );
  }

  if (error.code === "RESCORE_FAILED") {
    const sessionId = error.details.session_id;
    return jsonError(
      "RESCORE_FAILED",
      "Final answer re-score failed.",
      requestId,
      502,
      typeof sessionId === "string" ? { session_id: sessionId } : {}
    );
  }

  return jsonError(
    error.code,
    error.message,
    requestId,
    error.status,
    sanitizeDetails(error.details)
  );
}

function sanitizeDetails(details: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => key !== "cause")
  );
}
