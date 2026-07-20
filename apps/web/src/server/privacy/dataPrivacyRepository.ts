type SupabaseError = { code?: string; message: string };
type QueryValue<T> = { data: T | null; error: SupabaseError | null };

type SelectBuilder<T> = PromiseLike<QueryValue<T[]>> & {
  eq(column: string, value: unknown): SelectBuilder<T>;
  in(column: string, values: readonly string[]): SelectBuilder<T>;
  order(
    column: string,
    options?: { ascending?: boolean }
  ): SelectBuilder<T>;
  maybeSingle(): Promise<QueryValue<T>>;
};

export type DataPrivacySupabaseClient = {
  from(table: string): {
    select(columns: string): SelectBuilder<Record<string, unknown>>;
  };
  rpc(
    name: "delete_my_training_data",
    args?: Record<string, never>
  ): Promise<QueryValue<unknown>>;
};

export type TrainingDataExport = {
  schemaVersion: "stg-training-export-v2";
  exportedAt: string;
  profile: Record<string, unknown> | null;
  attempts: Record<string, unknown>[];
  scores: Record<string, unknown>[];
  feedback: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  revisions: Record<string, unknown>[];
  productEvents: Record<string, unknown>[];
  usageCounters: Record<string, unknown>[];
  aiJobs: Record<string, unknown>[];
};

export type DeleteTrainingDataResult = {
  deleted: true;
  sessions: number;
  attempts: number;
  events: number;
};

const profileColumns =
  "user_id, target_role, interview_type, training_goal, preferred_answer_language, consent_to_anonymized_evals, onboarding_completed_at, created_at, updated_at";
const attemptColumns =
  "id, user_id, question_id, practice_day, original_answer, idempotency_key, client_started_at, status, analysis_prompt_version, coaching_prompt_version, ai_model, rubric_version, repair_count, error_code, analysis_latency_ms, coaching_latency_ms, total_latency_ms, created_at";
const scoreColumns =
  "attempt_id, answer_relevance, core_message, structure, evidence, interview_impact, total_score, rubric_evidence, created_at";
const feedbackColumns =
  "attempt_id, question_analysis, observable_features, diagnosis, rewrite, why_better, growth_suggestion, safety_flags, created_at";
const sessionColumns =
  "id, user_id, initial_attempt_id, final_attempt_id, idempotency_key, practice_day, feedback_mode, feedback_shown_at, status, created_at, completed_at";
const revisionColumns =
  "id, session_id, idempotency_key, action, edited_text, client_decided_at, created_at";
const productEventColumns =
  "id, event_name, session_id, attempt_id, metadata, occurred_at, created_at";
const usageCounterColumns =
  "usage_date, metric, quantity, updated_at";
const safeAiJobColumns =
  "id, attempt_id, stage, status, provider, model, prompt_version, rubric_version, retry_count, max_retries, input_tokens, output_tokens, total_tokens, cost_microusd, latency_ms, error_code, started_at, completed_at, created_at, updated_at";

export function createDataPrivacyRepository(
  client: DataPrivacySupabaseClient,
  now: () => string = () => new Date().toISOString()
) {
  return {
    async loadTrainingData(userId: string): Promise<TrainingDataExport> {
      const [
        profileResult,
        attemptsResult,
        sessionsResult,
        productEventsResult,
        usageCountersResult
      ] = await Promise.all([
        client
          .from("user_profiles")
          .select(profileColumns)
          .eq("user_id", userId)
          .maybeSingle(),
        client
          .from("attempts")
          .select(attemptColumns)
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        client
          .from("practice_sessions")
          .select(sessionColumns)
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        client
          .from("product_events")
          .select(productEventColumns)
          .eq("user_id", userId)
          .order("occurred_at", { ascending: true }),
        client
          .from("usage_counters")
          .select(usageCounterColumns)
          .eq("user_id", userId)
          .order("usage_date", { ascending: true })
      ]);

      ensureNoError(profileResult.error);
      ensureNoError(attemptsResult.error);
      ensureNoError(sessionsResult.error);
      ensureNoError(productEventsResult.error);
      ensureNoError(usageCountersResult.error);

      const attempts = attemptsResult.data ?? [];
      const sessions = sessionsResult.data ?? [];
      const attemptIds = attempts.flatMap((attempt) =>
        typeof attempt.id === "string" ? [attempt.id] : []
      );
      const sessionIds = sessions.flatMap((session) =>
        typeof session.id === "string" ? [session.id] : []
      );

      const [scores, feedback, revisions, aiJobs] = await Promise.all([
        loadOwnedChildren(client, "scores", scoreColumns, "attempt_id", attemptIds),
        loadOwnedChildren(
          client,
          "ai_feedback",
          feedbackColumns,
          "attempt_id",
          attemptIds
        ),
        loadOwnedChildren(
          client,
          "revision_events",
          revisionColumns,
          "session_id",
          sessionIds
        ),
        loadOwnedChildren(
          client,
          "ai_jobs",
          safeAiJobColumns,
          "attempt_id",
          attemptIds
        )
      ]);

      return {
        schemaVersion: "stg-training-export-v2",
        exportedAt: now(),
        profile: profileResult.data,
        attempts,
        scores,
        feedback,
        sessions,
        revisions,
        productEvents: productEventsResult.data ?? [],
        usageCounters: usageCountersResult.data ?? [],
        aiJobs
      };
    },

    async deleteOwnTrainingData(): Promise<DeleteTrainingDataResult> {
      const { data, error } = await client.rpc("delete_my_training_data", {});
      ensureNoError(error);
      if (!isDeleteResult(data)) {
        throw new Error("Training-data deletion returned an invalid result.");
      }
      return data;
    }
  };
}

async function loadOwnedChildren(
  client: DataPrivacySupabaseClient,
  table: string,
  columns: string,
  ownershipColumn: string,
  ownerIds: string[]
) {
  if (ownerIds.length === 0) return [];
  const { data, error } = await client
    .from(table)
    .select(columns)
    .in(ownershipColumn, ownerIds)
    .order("created_at", { ascending: true });
  ensureNoError(error);
  return data ?? [];
}

function ensureNoError(error: SupabaseError | null) {
  if (!error) return;
  const repositoryError = new Error("Training-data persistence failed.");
  (repositoryError as Error & { code?: string }).code = error.code;
  throw repositoryError;
}

function isDeleteResult(value: unknown): value is DeleteTrainingDataResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    item.deleted === true &&
    Number.isInteger(item.sessions) &&
    Number.isInteger(item.attempts) &&
    Number.isInteger(item.events)
  );
}
