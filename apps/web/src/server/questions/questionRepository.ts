import { assertTrainingDayNumber } from "@/server/questions/dayNumber";
import type {
  GrowthProfileRow,
  QuestionRepository,
  QuestionRow,
  TrainingDayNumber
} from "@/server/questions/types";

type QueryResult<T> = Promise<{
  data: T | null;
  error: { message: string } | null;
}>;

type SupabaseFilterBuilder<T> = {
  eq: (column: string, value: unknown) => SupabaseFilterBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryResult<T[]>;
  single: () => QueryResult<T>;
};

export type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => SupabaseFilterBuilder<unknown>;
  };
};

function ensureNoRepositoryError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export function createSupabaseQuestionRepository(
  supabase: SupabaseLikeClient
): QuestionRepository {
  return {
    async listActiveQuestions() {
      const query = supabase
        .from("questions")
        .select(
          "id, day_number, title, scenario, prompt, learning_goal, expected_structure, evaluation_focus, knowledge_card, is_active, created_at, updated_at"
        ) as SupabaseFilterBuilder<QuestionRow>;

      const { data, error } = await query
        .eq("is_active", true)
        .order("day_number", { ascending: true });

      ensureNoRepositoryError(error);
      return data ?? [];
    },

    async findActiveQuestionByDay(dayNumber: TrainingDayNumber) {
      assertTrainingDayNumber(dayNumber);

      const query = supabase
        .from("questions")
        .select(
          "id, day_number, title, scenario, prompt, learning_goal, expected_structure, evaluation_focus, knowledge_card, is_active, created_at, updated_at"
        )
        .eq("is_active", true) as SupabaseFilterBuilder<QuestionRow>;

      const { data, error } = await query.eq("day_number", dayNumber).single();

      ensureNoRepositoryError(error);
      return data;
    },

    async findGrowthProfile(userId: string) {
      const query = supabase
        .from("growth_profiles")
        .select(
          "user_id, level_1_score, level_2_score, level_3_score, level_4_score, current_day, updated_at"
        ) as SupabaseFilterBuilder<GrowthProfileRow>;

      const { data, error } = await query.eq("user_id", userId).single();

      ensureNoRepositoryError(error);
      return data;
    },

    async listCompletedAttemptDayNumbers(userId: string) {
      const query = supabase
        .from("attempts")
        .select("questions(day_number)")
        .eq("user_id", userId) as SupabaseFilterBuilder<{
        questions: { day_number: number } | null;
      }>;

      const { data, error } = await query.eq("status", "completed").order("created_at");

      ensureNoRepositoryError(error);
      return (data ?? [])
        .map((row) => row.questions?.day_number)
        .filter((dayNumber): dayNumber is number => typeof dayNumber === "number");
    }
  };
}
