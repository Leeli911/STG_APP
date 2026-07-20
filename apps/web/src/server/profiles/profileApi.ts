import { randomUUID } from "node:crypto";
import { z } from "zod";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import {
  recordProductEventBestEffort,
  type ProductEventRecorder
} from "@/server/product-events";
import { toUserProfileDto, type UserProfileRow } from "@/server/profiles/types";

type SupabaseError = { message: string };
type QueryResult<T> = Promise<{ data: T | null; error: SupabaseError | null }>;

export type ProfileSupabaseClient = {
  auth: {
    getUser(): Promise<{ data: { user: { id: string } | null } }>;
  };
  from(table: "user_profiles"): {
    select(columns: string): {
      eq(column: "user_id", value: string): {
        maybeSingle(): QueryResult<UserProfileRow>;
      };
    };
  };
  rpc(name: "upsert_user_profile", args: Record<string, unknown>): QueryResult<unknown>;
};

const profileColumns =
  "user_id, target_role, interview_type, training_goal, preferred_answer_language, consent_to_anonymized_evals, onboarding_completed_at, created_at, updated_at";

const ProfileInputSchema = z.object({
  target_role: z.string().trim().min(2).max(120),
  interview_type: z.enum(["behavioral", "case", "general"]),
  training_goal: z.string().trim().min(10).max(500),
  preferred_answer_language: z.literal("zh"),
  consent_to_anonymized_evals: z.boolean()
});

export async function handleGetProfile(client: ProfileSupabaseClient) {
  const requestId = randomUUID();
  const user = await readUser(client);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Authentication is required.", requestId, 401);
  }

  try {
    const { data, error } = await client
      .from("user_profiles")
      .select(profileColumns)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return jsonSuccess(
      { profile: data ? toUserProfileDto(data) : null },
      requestId
    );
  } catch {
    return jsonError("DATABASE_ERROR", "Unable to load profile.", requestId, 500);
  }
}

export async function handlePutProfile(
  request: Request,
  client: ProfileSupabaseClient,
  recordProductEvent?: ProductEventRecorder
) {
  const requestId = randomUUID();
  const user = await readUser(client);
  if (!user) {
    return jsonError("UNAUTHENTICATED", "Authentication is required.", requestId, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("VALIDATION_ERROR", "Request body must be valid JSON.", requestId, 400);
  }

  const parsed = ProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Profile fields are invalid.",
      requestId,
      400,
      { issues: parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })) }
    );
  }

  try {
    const input = parsed.data;
    const { error } = await client.rpc("upsert_user_profile", {
      p_target_role: input.target_role,
      p_interview_type: input.interview_type,
      p_training_goal: input.training_goal,
      p_preferred_answer_language: input.preferred_answer_language,
      p_consent_to_anonymized_evals: input.consent_to_anonymized_evals
    });
    if (error) throw new Error(error.message);

    const { data, error: readError } = await client
      .from("user_profiles")
      .select(profileColumns)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError || !data) throw new Error(readError?.message ?? "Profile was not returned.");

    await recordProductEventBestEffort(
      recordProductEvent,
      {
        userId: user.id,
        event_name: "onboarding_completed",
        metadata: {
          interview_type: input.interview_type,
          preferred_answer_language: input.preferred_answer_language,
          consent_to_anonymized_evals: input.consent_to_anonymized_evals
        },
        request_id: requestId
      },
      "profile.onboarding_completed"
    );

    return jsonSuccess({ profile: toUserProfileDto(data) }, requestId);
  } catch {
    return jsonError("DATABASE_ERROR", "Unable to save profile.", requestId, 500);
  }
}

async function readUser(client: ProfileSupabaseClient) {
  try {
    const { data } = await client.auth.getUser();
    return data.user;
  } catch {
    return null;
  }
}
