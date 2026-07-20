import type { PipelineProfileContext } from "@/server/ai/pipeline";

type SupabaseError = { message: string };
type ProfileContextRow = {
  target_role: string;
  training_goal: string;
  preferred_answer_language: "zh" | "en";
};

export type SupabaseProfileContextClient = {
  from(table: "user_profiles"): {
    select(columns: string): {
      eq(column: "user_id", value: string): {
        maybeSingle(): Promise<{
          data: ProfileContextRow | null;
          error: SupabaseError | null;
        }>;
      };
    };
  };
};

export function createProfileContextResolver(
  client: SupabaseProfileContextClient
) {
  return async (userId: string): Promise<PipelineProfileContext | undefined> => {
    const { data, error } = await client
      .from("user_profiles")
      .select("target_role, training_goal, preferred_answer_language")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return undefined;
    return {
      targetRole: data.target_role,
      trainingGoal: data.training_goal,
      preferredAnswerLanguage: data.preferred_answer_language
    };
  };
}
