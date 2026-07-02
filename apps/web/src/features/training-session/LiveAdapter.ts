import {
  TrainingSessionGatewayError,
  type CommitTrainingSessionRevisionInput,
  type CreateTrainingSessionGatewayInput,
  type TrainingSessionGateway,
  type TrainingSessionGatewayErrorCode
} from "@/features/training-session/TrainingSessionGateway";
import type { TrainingSessionDto } from "@/server/training-sessions/types";

export type TrainingSessionFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type LiveTrainingSessionGatewayOptions = {
  fetch?: TrainingSessionFetch;
  baseUrl?: string;
};

export function createLiveTrainingSessionGateway(
  options: LiveTrainingSessionGatewayOptions = {}
): TrainingSessionGateway {
  return new LiveTrainingSessionGateway(options);
}

class LiveTrainingSessionGateway implements TrainingSessionGateway {
  private readonly fetch: TrainingSessionFetch;
  private readonly baseUrl: string;

  constructor(options: LiveTrainingSessionGatewayOptions) {
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = options.baseUrl ?? "";
  }

  async createSession(input: CreateTrainingSessionGatewayInput) {
    const { session } = await this.request<{ session: TrainingSessionDto }>(
      "/api/training-sessions",
      {
        method: "POST",
        headers: this.jsonHeaders(input.idempotencyKey),
        body: JSON.stringify({
          initial_attempt_id: input.initialAttemptId
        })
      }
    );

    return session;
  }

  async getSession(sessionId: string) {
    const { session } = await this.request<{ session: TrainingSessionDto }>(
      `/api/training-sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "GET"
      }
    );

    return session;
  }

  async commitRevision(input: CommitTrainingSessionRevisionInput) {
    try {
      const { session } = await this.request<{ session: TrainingSessionDto }>(
        `/api/training-sessions/${encodeURIComponent(input.sessionId)}/revision`,
        {
          method: "POST",
          headers: this.jsonHeaders(input.idempotencyKey),
          body: JSON.stringify({
            action: input.action,
            edited_text: input.editedText,
            client_decided_at: input.clientDecidedAt
          })
        }
      );

      return session;
    } catch (error) {
      if (
        error instanceof TrainingSessionGatewayError &&
        error.code === "RESCORE_FAILED"
      ) {
        return this.reconcileSession(input.sessionId, error);
      }

      if (
        error instanceof TrainingSessionGatewayError &&
        error.code === "NETWORK_ERROR"
      ) {
        return this.reconcileSession(input.sessionId, error);
      }

      throw error;
    }
  }

  private async reconcileSession(
    sessionId: string,
    originalError: TrainingSessionGatewayError
  ) {
    try {
      return await this.getSession(sessionId);
    } catch {
      if (originalError.code === "NETWORK_ERROR") {
        throw new TrainingSessionGatewayError(
          "NETWORK_UNCERTAIN",
          "Revision outcome is unknown after a network error.",
          {
            status: 0,
            details: {
              session_id: sessionId
            },
            cause: originalError
          }
        );
      }

      throw originalError;
    }
  }

  private async request<TData>(path: string, init: RequestInit) {
    let response: Response;
    try {
      response = await this.fetch(this.url(path), init);
    } catch (error) {
      throw new TrainingSessionGatewayError(
        "NETWORK_ERROR",
        "Training session request failed before a response was received.",
        {
          status: 0,
          cause: error
        }
      );
    }

    const envelope = await this.readEnvelope(response);
    if (isRecord(envelope) && envelope.ok === true) {
      if (!isRecord(envelope.data)) {
        throw invalidResponse(response.status);
      }
      return envelope.data as TData;
    }

    if (
      isRecord(envelope) &&
      envelope.ok === false &&
      isRecord(envelope.error)
    ) {
      throw new TrainingSessionGatewayError(
        toGatewayErrorCode(envelope.error.code),
        readString(envelope.error.message, "Training session request failed."),
        {
          status: response.status,
          details: isRecord(envelope.error.details)
            ? envelope.error.details
            : {}
        }
      );
    }

    throw invalidResponse(response.status);
  }

  private async readEnvelope(response: Response) {
    try {
      return (await response.json()) as unknown;
    } catch (error) {
      throw new TrainingSessionGatewayError(
        "INVALID_RESPONSE",
        "Training session API returned an unreadable response.",
        {
          status: response.status,
          cause: error
        }
      );
    }
  }

  private jsonHeaders(idempotencyKey: string) {
    return {
      "content-type": "application/json",
      "x-idempotency-key": idempotencyKey
    };
  }

  private url(path: string) {
    if (!this.baseUrl) return path;
    return new URL(path, this.baseUrl).toString();
  }
}

function invalidResponse(status: number) {
  return new TrainingSessionGatewayError(
    "INVALID_RESPONSE",
    "Training session API returned an invalid response envelope.",
    { status }
  );
}

function toGatewayErrorCode(value: unknown): TrainingSessionGatewayErrorCode {
  switch (value) {
    case "VALIDATION_ERROR":
    case "UNAUTHENTICATED":
    case "FORBIDDEN":
    case "NOT_FOUND":
    case "IDEMPOTENCY_KEY_REUSED":
    case "REVISION_ALREADY_COMMITTED":
    case "RESCORE_FAILED":
    case "INTERNAL_ERROR":
      return value;
    default:
      return "INTERNAL_ERROR";
  }
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
