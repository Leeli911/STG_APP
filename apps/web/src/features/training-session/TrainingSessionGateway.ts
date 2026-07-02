import type {
  RevisionAction,
  TrainingSessionDto
} from "@/server/training-sessions/types";

export type CreateTrainingSessionGatewayInput = {
  initialAttemptId: string;
  idempotencyKey: string;
};

export type CommitTrainingSessionRevisionInput = {
  sessionId: string;
  idempotencyKey: string;
  action: RevisionAction;
  editedText: string | null;
  clientDecidedAt: string;
};

export type TrainingSessionGateway = {
  createSession(
    input: CreateTrainingSessionGatewayInput
  ): Promise<TrainingSessionDto>;
  getSession(sessionId: string): Promise<TrainingSessionDto>;
  commitRevision(
    input: CommitTrainingSessionRevisionInput
  ): Promise<TrainingSessionDto>;
};

export type TrainingSessionGatewayErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "IDEMPOTENCY_KEY_REUSED"
  | "REVISION_ALREADY_COMMITTED"
  | "RESCORE_FAILED"
  | "NETWORK_ERROR"
  | "NETWORK_UNCERTAIN"
  | "INVALID_RESPONSE"
  | "INTERNAL_ERROR";

export class TrainingSessionGatewayError extends Error {
  readonly code: TrainingSessionGatewayErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: TrainingSessionGatewayErrorCode,
    message: string,
    {
      status = 500,
      details = {},
      cause
    }: {
      status?: number;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = "TrainingSessionGatewayError";
    this.code = code;
    this.status = status;
    this.details = details;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
