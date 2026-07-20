export type AiGenerateJsonInput = {
  system: string;
  user: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  output: {
    name: string;
    schema: Record<string, unknown>;
  };
  /** Stable for retries of one durable background job. */
  idempotencyKey?: string;
};

export type AiGenerateJsonResult = {
  text: string;
  model: string;
  latencyMs: number;
  responseId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AiBackgroundResponseStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | "incomplete";

export type AiBackgroundStartResult = {
  responseId: string;
  status: AiBackgroundResponseStatus;
  model: string;
};

export type AiBackgroundResponseResult = AiBackgroundStartResult & {
  text: string | null;
  errorCode: string | null;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type AiWebhookEvent = {
  eventId: string;
  type:
    | "response.completed"
    | "response.failed"
    | "response.cancelled"
    | "response.incomplete";
  responseId: string;
  createdAt: number;
};

export type StgAiClient = {
  generateJson: (input: AiGenerateJsonInput) => Promise<AiGenerateJsonResult>;
};

export type StgBackgroundAiClient = StgAiClient & {
  startBackgroundJson: (
    input: AiGenerateJsonInput
  ) => Promise<AiBackgroundStartResult>;
  retrieveBackgroundJson: (
    responseId: string,
    timeoutMs?: number
  ) => Promise<AiBackgroundResponseResult>;
};

export type AiWebhookVerifier = {
  unwrap: (
    payload: string,
    headers: Headers
  ) => Promise<AiWebhookEvent | null>;
};
