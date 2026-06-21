import type {
  AiFeedbackInsert,
  AiFeedbackRow,
  AttemptInsert,
  AttemptQuestionRow,
  AttemptRepository,
  AttemptRow,
  AttemptStatus,
  ScoreRow
} from "@/server/attempts/types";

type SupabaseError = {
  message: string;
  code?: string;
};

type QueryResult<T> = Promise<{
  data: T | null;
  error: SupabaseError | null;
}>;

type SupabaseFilterBuilder<T> = {
  eq: (column: string, value: unknown) => SupabaseFilterBuilder<T>;
  maybeSingle: () => QueryResult<T>;
  single: () => QueryResult<T>;
};

type SupabaseInsertBuilder<T> = {
  select: (columns: string) => {
    single: () => QueryResult<T>;
  };
};

type SupabaseUpdateBuilder<T> = {
  eq: (column: string, value: unknown) => SupabaseUpdateBuilder<T>;
  select: (columns: string) => {
    single: () => QueryResult<T>;
  };
};

export type SupabaseAttemptClient = {
  from: (table: string) => {
    select: (columns: string) => SupabaseFilterBuilder<unknown>;
    insert: (values: Record<string, unknown>) => SupabaseInsertBuilder<unknown>;
    update: (values: Record<string, unknown>) => SupabaseUpdateBuilder<unknown>;
  };
};

const attemptSelectColumns =
  "id, user_id, question_id, original_answer, status, idempotency_key, client_started_at, created_at, analysis_prompt_version, coaching_prompt_version, ai_model, repair_count, error_code, analysis_latency_ms, coaching_latency_ms, total_latency_ms, questions(day_number)";

type AttemptRowWithQuestion = Omit<AttemptRow, "day_number"> & {
  questions:
    | {
        day_number: number;
      }
    | {
        day_number: number;
      }[]
    | null;
};

export function createSupabaseAttemptRepository(
  supabase: SupabaseAttemptClient
): AttemptRepository {
  return {
    async findActiveQuestionById(questionId) {
      const query = supabase
        .from("questions")
        .select(
          "id, day_number, title, scenario, prompt, learning_goal, expected_structure, evaluation_focus, is_active"
        ) as SupabaseFilterBuilder<AttemptQuestionRow>;

      const { data, error } = await query.eq("id", questionId).maybeSingle();

      ensureNoRepositoryError(error);
      return data;
    },

    async findAttemptByIdempotencyKey(userId, idempotencyKey) {
      const query = supabase
        .from("attempts")
        .select(attemptSelectColumns)
        .eq("user_id", userId) as SupabaseFilterBuilder<AttemptRowWithQuestion>;

      const { data, error } = await query
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      ensureNoRepositoryError(error);
      return data ? mapAttemptRow(data) : null;
    },

    async createAttempt(insert) {
      const values = {
        user_id: insert.userId,
        question_id: insert.questionId,
        original_answer: insert.answerText,
        status: "submitted" satisfies AttemptStatus,
        idempotency_key: insert.idempotencyKey,
        client_started_at: insert.clientStartedAt ?? null
      };

      const query = supabase
        .from("attempts")
        .insert(values)
        .select(attemptSelectColumns) as {
        single: () => QueryResult<AttemptRowWithQuestion>;
      };

      const { data, error } = await query.single();

      ensureNoRepositoryError(error);

      if (!data) {
        throw new Error("Attempt insert did not return a row.");
      }

      return mapAttemptRow(data);
    },

    async updateAttemptStatus(userId, attemptId, status) {
      const query = supabase
        .from("attempts")
        .update({
          status
        })
        .eq("user_id", userId)
        .eq("id", attemptId)
        .select(attemptSelectColumns) as {
        single: () => QueryResult<AttemptRowWithQuestion>;
      };

      const { data, error } = await query.single();

      ensureNoRepositoryError(error);

      if (!data) {
        throw new Error("Attempt status update did not return a row.");
      }

      return mapAttemptRow(data);
    },

    async findAttemptById(userId, attemptId) {
      const query = supabase
        .from("attempts")
        .select(attemptSelectColumns)
        .eq("user_id", userId) as SupabaseFilterBuilder<AttemptRowWithQuestion>;

      const { data, error } = await query.eq("id", attemptId).maybeSingle();

      ensureNoRepositoryError(error);
      return data ? mapAttemptRow(data) : null;
    },

    async findScoreByAttemptId(attemptId) {
      const query = supabase
        .from("scores")
        .select(
          "attempt_id, answer_relevance, core_message, structure, evidence, interview_impact, total_score, rubric_evidence, created_at"
        ) as SupabaseFilterBuilder<ScoreRow>;

      const { data, error } = await query
        .eq("attempt_id", attemptId)
        .maybeSingle();

      ensureNoRepositoryError(error);
      return data;
    },

    async createScore(score) {
      const query = supabase
        .from("scores")
        .insert(score)
        .select(
          "attempt_id, answer_relevance, core_message, structure, evidence, interview_impact, total_score, rubric_evidence, created_at"
        ) as {
        single: () => QueryResult<ScoreRow>;
      };

      const { data, error } = await query.single();

      ensureNoRepositoryError(error);

      if (!data) {
        throw new Error("Score insert did not return a row.");
      }

      return data;
    },

    async findAiFeedbackByAttemptId(attemptId) {
      const query = supabase
        .from("ai_feedback")
        .select(
          "attempt_id, question_analysis, observable_features, diagnosis, rewrite, why_better, growth_suggestion, safety_flags, created_at"
        ) as SupabaseFilterBuilder<AiFeedbackRow>;

      const { data, error } = await query
        .eq("attempt_id", attemptId)
        .maybeSingle();

      ensureNoRepositoryError(error);
      return data;
    },

    async createAiFeedback(feedback) {
      const values = feedback satisfies AiFeedbackInsert;
      const query = supabase
        .from("ai_feedback")
        .insert(values)
        .select(
          "attempt_id, question_analysis, observable_features, diagnosis, rewrite, why_better, growth_suggestion, safety_flags, created_at"
        ) as {
        single: () => QueryResult<AiFeedbackRow>;
      };

      const { data, error } = await query.single();

      ensureNoRepositoryError(error);

      if (!data) {
        throw new Error("AI feedback insert did not return a row.");
      }

      return data;
    },

    async updateAttemptPipelineMetadata(userId, attemptId, metadata) {
      const query = supabase
        .from("attempts")
        .update(metadata)
        .eq("user_id", userId)
        .eq("id", attemptId)
        .select(attemptSelectColumns) as {
        single: () => QueryResult<AttemptRowWithQuestion>;
      };

      const { data, error } = await query.single();

      ensureNoRepositoryError(error);

      if (!data) {
        throw new Error("Attempt metadata update did not return a row.");
      }

      return mapAttemptRow(data);
    }
  };
}

function mapAttemptRow(row: AttemptRowWithQuestion): AttemptRow {
  const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;

  if (!question) {
    throw new Error("Attempt row is missing question day_number.");
  }

  return {
    id: row.id,
    user_id: row.user_id,
    question_id: row.question_id,
    day_number: question.day_number,
    original_answer: row.original_answer,
    status: row.status,
    idempotency_key: row.idempotency_key,
    client_started_at: row.client_started_at,
    created_at: row.created_at,
    analysis_prompt_version: row.analysis_prompt_version ?? null,
    coaching_prompt_version: row.coaching_prompt_version ?? null,
    ai_model: row.ai_model ?? null,
    repair_count: row.repair_count ?? null,
    error_code: row.error_code ?? null,
    analysis_latency_ms: row.analysis_latency_ms ?? null,
    coaching_latency_ms: row.coaching_latency_ms ?? null,
    total_latency_ms: row.total_latency_ms ?? null
  };
}

function ensureNoRepositoryError(error: SupabaseError | null) {
  if (error) {
    throw new Error(error.message);
  }
}
