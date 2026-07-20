import type {
  AiJob,
  AiJobRequestPayload,
  AiJobRepository,
  AiJobStage,
  AiJobStatus,
  ClaimedAiJob
} from "@/server/ai/jobs/types";

type SupabaseError = { message: string };

type RpcResult = Promise<{
  data: unknown;
  error: SupabaseError | null;
}>;

export type SupabaseAiJobClient = {
  rpc(
    functionName: string,
    parameters?: Record<string, unknown>
  ): RpcResult;
};

type AiJobDbRow = {
  id: string;
  user_id: string;
  attempt_id: string;
  stage: AiJobStage;
  status: AiJobStatus;
  provider: "openai";
  provider_response_id: string | null;
  provider_idempotency_key: string;
  request_payload: unknown;
  model: string;
  prompt_version: string;
  rubric_version: string;
  retry_count: number;
  max_retries: number;
  lease_token: string | null;
  lease_expires_at: string | null;
  error_code: string | null;
  updated_at: string;
};

export function createSupabaseAiJobRepository(
  supabase: SupabaseAiJobClient
): AiJobRepository {
  return {
    async claim(input) {
      const data = await callRpc(supabase, "claim_ai_job", {
        p_attempt_id: input.attemptId,
        p_stage: input.stage,
        p_model: input.model,
        p_prompt_version: input.promptVersion,
        p_request_payload: input.requestPayload,
        p_rubric_version: input.rubricVersion,
        p_lease_seconds: input.leaseSeconds ?? 120
      });
      if (data === null) return null;
      return requireClaimedJob(data);
    },

    async attachProviderResponse(jobId, leaseToken, providerResponseId) {
      const data = await callRpc(supabase, "attach_ai_job_response", {
        p_job_id: jobId,
        p_lease_token: leaseToken,
        p_provider_response_id: providerResponseId
      });
      return mapAiJob(requireRow(data));
    },

    async claimByProviderResponseId(providerResponseId, leaseSeconds = 120) {
      const data = await callRpc(supabase, "claim_ai_job_by_response", {
        p_provider_response_id: providerResponseId,
        p_lease_seconds: leaseSeconds
      });
      if (data === null) return null;
      return requireClaimedJob(data);
    },

    async claimReconcileCandidates({ staleBefore, limit, leaseSeconds = 120 }) {
      const data = await callRpc(supabase, "reconcile_ai_jobs", {
        p_stale_before: staleBefore,
        p_limit: limit,
        p_lease_seconds: leaseSeconds
      });
      if (!Array.isArray(data)) {
        throw new Error("reconcile_ai_jobs did not return a row set.");
      }
      return data.map(requireClaimedJob);
    },

    async fail(input) {
      const data = await callRpc(supabase, "fail_ai_job", {
        p_job_id: input.jobId,
        p_lease_token: input.leaseToken,
        p_error_code: input.errorCode,
        p_error_message: input.errorMessage
      });
      return mapAiJob(requireRow(data));
    },

    async completeStage(input) {
      const data = await callRpc(supabase, "complete_ai_job_stage", {
        p_job_id: input.jobId,
        p_lease_token: input.leaseToken,
        p_output_payload: input.output,
        p_metadata: {
          input_tokens: input.inputTokens,
          output_tokens: input.outputTokens,
          total_tokens: input.totalTokens,
          latency_ms: input.latencyMs
        }
      });
      return mapAiJob(requireRow(data));
    },

    async completeAndClaimNext(input) {
      const data = await callRpc(
        supabase,
        "complete_ai_job_stage_and_enqueue",
        {
          p_job_id: input.jobId,
          p_lease_token: input.leaseToken,
          p_output_payload: input.output,
          p_metadata: {
            input_tokens: input.inputTokens,
            output_tokens: input.outputTokens,
            total_tokens: input.totalTokens,
            latency_ms: input.latencyMs
          },
          p_next_stage: input.next.stage,
          p_next_model: input.next.model,
          p_next_prompt_version: input.next.promptVersion,
          p_next_rubric_version: input.next.rubricVersion,
          p_next_request_payload: input.next.requestPayload,
          p_lease_seconds: input.leaseSeconds ?? 120
        }
      );
      return requireClaimedJob(data);
    },

    async getCompletedStageOutput(attemptId, stage) {
      const data = await callRpc(supabase, "get_completed_ai_job_output", {
        p_attempt_id: attemptId,
        p_stage: stage
      });
      if (data === null) return null;
      if (typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Completed AI job output is invalid.");
      }
      return data as Record<string, unknown>;
    }
  };
}

async function callRpc(
  supabase: SupabaseAiJobClient,
  functionName: string,
  parameters: Record<string, unknown>
) {
  const { data, error } = await supabase.rpc(functionName, parameters);
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

function requireClaimedJob(value: unknown): ClaimedAiJob {
  const job = mapAiJob(requireRow(value));
  if (!job.leaseToken || !job.leaseExpiresAt) {
    throw new Error(`AI job ${job.id} was returned without a lease.`);
  }
  return {
    ...job,
    leaseToken: job.leaseToken,
    leaseExpiresAt: job.leaseExpiresAt
  };
}

function requireRow(value: unknown): AiJobDbRow {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") {
    throw new Error("AI job RPC did not return a row.");
  }
  return row as AiJobDbRow;
}

function mapAiJob(row: AiJobDbRow): AiJob {
  return {
    id: row.id,
    userId: row.user_id,
    attemptId: row.attempt_id,
    stage: row.stage,
    status: row.status,
    provider: row.provider,
    providerResponseId: row.provider_response_id,
    providerIdempotencyKey: row.provider_idempotency_key,
    requestPayload: requireRequestPayload(row.request_payload),
    model: row.model,
    promptVersion: row.prompt_version,
    rubricVersion: row.rubric_version,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    leaseToken: row.lease_token,
    leaseExpiresAt: row.lease_expires_at,
    errorCode: row.error_code,
    updatedAt: row.updated_at
  };
}

function requireRequestPayload(value: unknown): AiJobRequestPayload {
  if (!isRecord(value)) {
    throw new Error("AI job request_payload is invalid.");
  }
  const output = value.output;
  if (
    typeof value.system !== "string" ||
    typeof value.user !== "string" ||
    typeof value.model !== "string" ||
    typeof value.temperature !== "number" ||
    typeof value.timeoutMs !== "number" ||
    !isRecord(output) ||
    typeof output.name !== "string" ||
    !isRecord(output.schema)
  ) {
    throw new Error("AI job request_payload has an invalid shape.");
  }
  return value as AiJobRequestPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
