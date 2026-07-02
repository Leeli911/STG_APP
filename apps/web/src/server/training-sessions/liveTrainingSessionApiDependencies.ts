import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseAttemptRepository } from "@/server/attempts";
import type { SupabaseAttemptClient } from "@/server/attempts/attemptRepository";
import {
  createSupabaseTrainingSessionRepository,
  type SupabaseTrainingSessionClient
} from "@/server/training-sessions/trainingSessionRepository";
import { createTrainingSessionService } from "@/server/training-sessions/trainingSessionService";

export async function createLiveTrainingSessionApiDependencies() {
  const supabase = await createServerSupabaseClient();
  const attemptRepository = createSupabaseAttemptRepository(
    supabase as unknown as SupabaseAttemptClient
  );
  const sessionRepository = createSupabaseTrainingSessionRepository(
    supabase as unknown as SupabaseTrainingSessionClient
  );

  return {
    async getUser() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      return user ? { id: user.id } : null;
    },
    service: createTrainingSessionService({
      sessionRepository,
      attemptRepository
    })
  };
}
