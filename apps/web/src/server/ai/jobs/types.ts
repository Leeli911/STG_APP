import type {
  AiBackgroundResponseResult,
  AiGenerateJsonInput,
  AiWebhookVerifier,
  StgBackgroundAiClient
} from "@/server/ai/types";

export type AiJobRequestPayload = Omit<AiGenerateJsonInput, "idempotencyKey">;

export type AttemptState =
  | "queued"
  | "analyzing"
  | "coaching"
  | "feedback_ready"
  | "rescoring"
  | "completed"
  | "failed";

export type AiJobStage = "analysis" | "coaching" | "repair" | "rescore";

export type AiJobStatus =
  | "queued"
  | "submitted"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type AiJob = {
  id: string;
  userId: string;
  attemptId: string;
  stage: AiJobStage;
  status: AiJobStatus;
  provider: "openai";
  providerResponseId: string | null;
  providerIdempotencyKey: string;
  requestPayload: AiJobRequestPayload;
  model: string;
  promptVersion: string;
  rubricVersion: string;
  retryCount: number;
  maxRetries: number;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  errorCode: string | null;
  updatedAt: string;
};

export type ClaimedAiJob = AiJob & {
  leaseToken: string;
  leaseExpiresAt: string;
};

export type ClaimAiJobInput = {
  attemptId: string;
  stage: AiJobStage;
  model: string;
  promptVersion: string;
  rubricVersion: string;
  requestPayload: AiJobRequestPayload;
  leaseSeconds?: number;
};

export type CompleteAndClaimNextInput = {
  jobId: string;
  leaseToken: string;
  output: Record<string, unknown>;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  next: Omit<ClaimAiJobInput, "attemptId" | "leaseSeconds">;
  leaseSeconds?: number;
};

export type AiJobRepository = {
  /** Null means another worker already owns or submitted this active stage. */
  claim(input: ClaimAiJobInput): Promise<ClaimedAiJob | null>;
  attachProviderResponse(
    jobId: string,
    leaseToken: string,
    providerResponseId: string
  ): Promise<AiJob>;
  claimByProviderResponseId(
    providerResponseId: string,
    leaseSeconds?: number
  ): Promise<ClaimedAiJob | null>;
  claimReconcileCandidates(input: {
    staleBefore: string;
    limit: number;
    leaseSeconds?: number;
  }): Promise<ClaimedAiJob[]>;
  fail(input: {
    jobId: string;
    leaseToken: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<AiJob>;
  completeStage(input: {
    jobId: string;
    leaseToken: string;
    output: Record<string, unknown>;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
  }): Promise<AiJob>;
  completeAndClaimNext(
    input: CompleteAndClaimNextInput
  ): Promise<ClaimedAiJob>;
  getCompletedStageOutput(
    attemptId: string,
    stage: AiJobStage
  ): Promise<Record<string, unknown> | null>;
};

export type AiJobResultHandler = {
  onCompleted(
    job: ClaimedAiJob,
    response: AiBackgroundResponseResult
  ): Promise<void>;
  onFailed(
    job: ClaimedAiJob,
    response: AiBackgroundResponseResult
  ): Promise<void>;
};

export type AiBackgroundProvider = Pick<
  StgBackgroundAiClient,
  "startBackgroundJson" | "retrieveBackgroundJson"
>;

export type AiWebhookDependencies = {
  verifier: AiWebhookVerifier;
  repository: AiJobRepository;
  provider: AiBackgroundProvider;
  resultHandler: AiJobResultHandler;
};
