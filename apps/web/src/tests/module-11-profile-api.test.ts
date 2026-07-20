import {
  handleGetProfile,
  handlePutProfile,
  type ProfileSupabaseClient
} from "@/server/profiles/profileApi";
import type { UserProfileRow } from "@/server/profiles/types";

const profileRow: UserProfileRow = {
  user_id: "user-1",
  target_role: "数据分析师",
  interview_type: "behavioral",
  training_goal: "减少背景铺垫，并用证据说明自己的具体贡献。",
  preferred_answer_language: "zh",
  consent_to_anonymized_evals: false,
  onboarding_completed_at: "2026-07-20T00:00:00.000Z",
  created_at: "2026-07-20T00:00:00.000Z",
  updated_at: "2026-07-20T00:00:00.000Z"
};

describe("Beta user profile API", () => {
  it("returns null before onboarding is completed", async () => {
    const response = await handleGetProfile(createClient({ row: null }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { profile: null }
    });
  });

  it("rejects incomplete onboarding data before calling the RPC", async () => {
    const client = createClient({ row: null });
    const response = await handlePutProfile(
      request({
        target_role: "A",
        interview_type: "unknown",
        training_goal: "short",
        preferred_answer_language: "zh",
        consent_to_anonymized_evals: false
      }),
      client
    );

    expect(response.status).toBe(400);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects English feedback in the current Chinese beta", async () => {
    const client = createClient({ row: null });
    const response = await handlePutProfile(
      request({
        target_role: "数据分析师",
        interview_type: "behavioral",
        training_goal: "减少背景铺垫，并用证据说明自己的具体贡献。",
        preferred_answer_language: "en",
        consent_to_anonymized_evals: false
      }),
      client
    );

    expect(response.status).toBe(400);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("stores the profile through the ownership RPC and returns the DTO", async () => {
    const client = createClient({ row: profileRow });
    const recordProductEvent = vi.fn().mockResolvedValue(undefined);
    const response = await handlePutProfile(
      request({
        target_role: profileRow.target_role,
        interview_type: profileRow.interview_type,
        training_goal: profileRow.training_goal,
        preferred_answer_language: profileRow.preferred_answer_language,
        consent_to_anonymized_evals: false
      }),
      client,
      recordProductEvent
    );

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("upsert_user_profile", {
      p_target_role: profileRow.target_role,
      p_interview_type: profileRow.interview_type,
      p_training_goal: profileRow.training_goal,
      p_preferred_answer_language: "zh",
      p_consent_to_anonymized_evals: false
    });
    expect(recordProductEvent).toHaveBeenCalledWith({
      userId: "user-1",
      event_name: "onboarding_completed",
      metadata: {
        interview_type: "behavioral",
        preferred_answer_language: "zh",
        consent_to_anonymized_evals: false
      },
      request_id: expect.any(String)
    });
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        profile: {
          targetRole: "数据分析师",
          interviewType: "behavioral",
          preferredAnswerLanguage: "zh"
        }
      }
    });
  });

  it("requires an authenticated user", async () => {
    const response = await handleGetProfile(
      createClient({ row: null, authenticated: false })
    );

    expect(response.status).toBe(401);
  });
});

function request(body: unknown) {
  return new Request("http://localhost/api/me/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

function createClient({
  row,
  authenticated = true
}: {
  row: UserProfileRow | null;
  authenticated?: boolean;
}) {
  const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: "user-1" } : null }
      })
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null })
        }))
      }))
    })),
    rpc
  };

  return client as unknown as ProfileSupabaseClient & { rpc: typeof rpc };
}
