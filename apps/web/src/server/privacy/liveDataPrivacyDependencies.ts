import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import {
  createDataPrivacyRepository,
  type DataPrivacySupabaseClient
} from "@/server/privacy/dataPrivacyRepository";
import type { DataPrivacyApiDependencies } from "@/server/privacy/dataPrivacyApi";

export async function createLiveDataPrivacyDependencies(): Promise<DataPrivacyApiDependencies> {
  const supabase = await createServerSupabaseClient();
  // delete_my_training_data() deliberately derives ownership from auth.uid().
  // Keep that mutation on the authenticated request client instead of widening
  // the RPC to accept a caller-supplied user id.
  const userRepository = createDataPrivacyRepository(
    supabase as unknown as DataPrivacySupabaseClient
  );

  return {
    async getUser() {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      return user ? { id: user.id } : null;
    },
    loadTrainingData(userId) {
      // Authority tables intentionally have no browser-readable policies. Create
      // the privileged client only for this authenticated, explicitly filtered
      // export operation so deletion keeps working without Service Role access.
      const authoritativeSupabase = createServiceRoleSupabaseClient();
      const exportRepository = createDataPrivacyRepository(
        authoritativeSupabase as unknown as DataPrivacySupabaseClient
      );
      return exportRepository.loadTrainingData(userId);
    },
    deleteOwnTrainingData(_userId) {
      return userRepository.deleteOwnTrainingData();
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error("Sign-out failed.");
    }
  };
}
