import type {
  OverviewAttemptRow,
  OverviewPracticeSessionRow,
  OverviewQuestionRow,
  OverviewRevisionRow,
  OverviewScoreRow,
  TrainingOverviewRepository
} from "@/server/training-overview/types";

type SupabaseError = {
  message: string;
};

type QueryResult<T> = Promise<{
  data: T | null;
  error: SupabaseError | null;
}>;

type FilterBuilder<T> = {
  eq(column: string, value: unknown): FilterBuilder<T>;
  order(
    column: string,
    options?: { ascending?: boolean }
  ): QueryResult<T[]>;
};

type SelectBuilder<T> = FilterBuilder<T> & {
  order(
    column: string,
    options?: { ascending?: boolean }
  ): QueryResult<T[]>;
};

export type SupabaseTrainingOverviewClient = {
  from(table: string): {
    select(columns: string): SelectBuilder<unknown>;
  };
};

type AttemptWithQuestion = Omit<OverviewAttemptRow, "day_number" | "question_title"> & {
  practice_day: number;
  questions:
    | { title: string }
    | { title: string }[]
    | null;
};

export function createSupabaseTrainingOverviewRepository(
  supabase: SupabaseTrainingOverviewClient
): TrainingOverviewRepository {
  return {
    async listPracticeSessions(userId) {
      const query = supabase
        .from("practice_sessions")
        .select(
          "id, user_id, initial_attempt_id, final_attempt_id, practice_day, status, created_at, completed_at"
        )
        .eq("user_id", userId) as FilterBuilder<OverviewPracticeSessionRow>;
      const { data, error } = await query.order("created_at", {
        ascending: false
      });
      ensureNoError(error);
      return data ?? [];
    },

    async listAttempts(userId) {
      const query = supabase
        .from("attempts")
        .select(
          "id, practice_day, original_answer, status, created_at, analysis_prompt_version, coaching_prompt_version, rubric_version, ai_model, questions(title)"
        )
        .eq("user_id", userId) as FilterBuilder<AttemptWithQuestion>;
      const { data, error } = await query.order("created_at", {
        ascending: false
      });
      ensureNoError(error);

      return (data ?? []).flatMap((row) => {
        const question = Array.isArray(row.questions)
          ? row.questions[0]
          : row.questions;
        if (!question) return [];

        return [
          {
            id: row.id,
            day_number: row.practice_day,
            question_title: question.title,
            original_answer: row.original_answer,
            status: row.status,
            created_at: row.created_at,
            analysis_prompt_version: row.analysis_prompt_version,
            coaching_prompt_version: row.coaching_prompt_version,
            rubric_version: row.rubric_version,
            ai_model: row.ai_model
          }
        ];
      });
    },

    async listScores() {
      const query = supabase
        .from("scores")
        .select(
          "attempt_id, answer_relevance, core_message, structure, evidence, interview_impact, total_score"
        ) as SelectBuilder<OverviewScoreRow>;
      const { data, error } = await query.order("created_at", {
        ascending: false
      });
      ensureNoError(error);
      return data ?? [];
    },

    async listRevisions() {
      const query = supabase
        .from("revision_events")
        .select("session_id, action, created_at") as SelectBuilder<OverviewRevisionRow>;
      const { data, error } = await query.order("created_at", {
        ascending: false
      });
      ensureNoError(error);
      return data ?? [];
    },

    async listActiveQuestions() {
      const query = supabase
        .from("stg_active_curriculum_questions")
        .select("id, day_number, title, prompt, learning_goal")
        .eq("is_active", true) as FilterBuilder<OverviewQuestionRow>;
      const { data, error } = await query.order("day_number", {
        ascending: true
      });
      ensureNoError(error);
      return data ?? [];
    }
  };
}

function ensureNoError(error: SupabaseError | null) {
  if (error) throw new Error(error.message);
}
