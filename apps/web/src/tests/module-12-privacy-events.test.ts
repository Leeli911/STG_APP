import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { redactLogContext } from "@/server/observability/logger";
import {
  createProductEventRecorder,
  recordProductEventBestEffort,
  type ProductEventRpcClient
} from "@/server/product-events";
import {
  handleDeleteTrainingData,
  handleGetTrainingDataExport,
  type DataPrivacyApiDependencies
} from "@/server/privacy";
import {
  createDataPrivacyRepository,
  type DataPrivacySupabaseClient
} from "@/server/privacy/dataPrivacyRepository";

const attemptId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const userId = "55555555-5555-4555-8555-555555555555";

describe("server-authoritative PII-safe product events", () => {
  it("records only whitelisted metadata with an explicit verified user id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "event-1" }, error: null });
    const recorder = createProductEventRecorder(eventRpcClient(rpc));
    await recorder({
        userId,
        event_name: "draft_submitted",
        attempt_id: attemptId,
        metadata: {
          practice_day: 1,
          character_count: 180,
          answer_language: "zh"
        },
        request_id: "request-1"
      });

    expect(rpc).toHaveBeenCalledWith(
      "record_product_event",
      expect.objectContaining({
        p_user_id: userId,
        p_event_name: "draft_submitted",
        p_attempt_id: attemptId,
        p_metadata: {
          practice_day: 1,
          character_count: 180,
          answer_language: "zh"
        }
      })
    );
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("original_answer");
  });

  it("rejects answer text and unknown metadata before the service-role RPC", async () => {
    const rpc = vi.fn();
    const recorder = createProductEventRecorder(eventRpcClient(rpc));

    await expect(
      recorder({
        userId,
        event_name: "feedback_viewed",
        session_id: sessionId,
        metadata: {
          practice_day: 1,
          answer_text: "this must never be telemetry"
        }
      } as never)
    ).rejects.toBeDefined();

    expect(rpc).not.toHaveBeenCalled();
  });

  it("removes the generic browser event route and grants the RPC only to service_role", () => {
    expect(
      existsSync(join(process.cwd(), "src/app/api/events/route.ts"))
    ).toBe(false);

    const migration = readFileSync(
      join(
        process.cwd(),
        "src/database/migrations/202607200001_add_beta_ai_infrastructure.sql"
      ),
      "utf8"
    );

    expect(migration).toContain("p_user_id uuid");
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("product_events_onboarding_once_idx");
    expect(migration).toContain("product_events_attempt_once_idx");
    expect(migration).toContain("product_events_session_once_idx");
    expect(migration).toContain("on conflict do nothing");
  });

  it("server telemetry failures are isolated from the core operation", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const recorded = await recordProductEventBestEffort(
      vi.fn().mockRejectedValue(new Error("database unavailable")),
      {
        userId,
        event_name: "onboarding_completed",
        metadata: {}
      },
      "test.onboarding"
    );

    expect(recorded).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("redacts PII, credentials and free-form answers from log context", () => {
    expect(
      redactLogContext({
        requestId: "request-1",
        email: "person@example.com",
        nested: {
          answerText: "private answer",
          note: "Contact person@example.com with Bearer abc123"
        }
      })
    ).toEqual({
      requestId: "request-1",
      email: "[REDACTED]",
      nested: {
        answerText: "[REDACTED]",
        note: "Contact [REDACTED_EMAIL] with Bearer [REDACTED]"
      }
    });
  });
});

describe("current-user training-data privacy APIs", () => {
  it("exports the authenticated user's data as a non-cacheable download", async () => {
    const dependencies = privacyDependencies();
    const response = await handleGetTrainingDataExport(dependencies);

    expect(response.status).toBe(200);
    expect(dependencies.loadTrainingData).toHaveBeenCalledWith("user-1");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain(
      "stg-training-data-2026-07-20.json"
    );
  });

  it("deletes through the current-user operation and signs out afterward", async () => {
    const dependencies = privacyDependencies();
    const response = await handleDeleteTrainingData(dependencies);

    expect(response.status).toBe(200);
    expect(dependencies.deleteOwnTrainingData).toHaveBeenCalledWith("user-1");
    expect(dependencies.signOut).toHaveBeenCalledTimes(1);
    expect(response.headers.get("clear-site-data")).toContain("storage");
  });

  it("does not query or delete anything without authentication", async () => {
    const dependencies = privacyDependencies(false);
    const exportResponse = await handleGetTrainingDataExport(dependencies);
    const deleteResponse = await handleDeleteTrainingData(dependencies);

    expect(exportResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
    expect(dependencies.loadTrainingData).not.toHaveBeenCalled();
    expect(dependencies.deleteOwnTrainingData).not.toHaveBeenCalled();
    expect(dependencies.signOut).not.toHaveBeenCalled();
  });

  it("derives score, feedback and revision ownership from owned parents", async () => {
    const queryLog: Array<[string, string, unknown]> = [];
    const client = fakePrivacyClient(queryLog);
    const repository = createDataPrivacyRepository(
      client,
      () => "2026-07-20T00:00:00.000Z"
    );

    const exported = await repository.loadTrainingData("user-1");

    expect(exported.attempts).toHaveLength(1);
    expect(exported.sessions).toHaveLength(1);
    expect(exported.scores).toEqual([{ attempt_id: attemptId, total_score: 80, created_at: "2026-07-20" }]);
    expect(exported.revisions).toEqual([{ session_id: sessionId, action: "accepted", created_at: "2026-07-20" }]);
    expect(exported.productEvents).toEqual([
      expect.objectContaining({ event_name: "draft_submitted", attempt_id: attemptId })
    ]);
    expect(exported.usageCounters).toEqual([
      { usage_date: "2026-07-20", metric: "ai_session", quantity: 1, updated_at: "2026-07-20" }
    ]);
    expect(exported.aiJobs).toEqual([
      expect.objectContaining({
        attempt_id: attemptId,
        stage: "analysis",
        status: "completed",
        error_code: "PROVIDER_TIMEOUT"
      })
    ]);
    expect(exported.aiJobs[0]).not.toHaveProperty("request_payload");
    expect(exported.aiJobs[0]).not.toHaveProperty("output_payload");
    expect(exported.aiJobs[0]).not.toHaveProperty("error_message");
    expect(exported.aiJobs[0]).not.toHaveProperty("provider_response_id");
    expect(exported.usageCounters[0]).not.toHaveProperty("idempotency_keys");
    expect(queryLog).toContainEqual(["attempts", "eq:user_id", "user-1"]);
    expect(queryLog).toContainEqual(["practice_sessions", "eq:user_id", "user-1"]);
    expect(queryLog).toContainEqual(["product_events", "eq:user_id", "user-1"]);
    expect(queryLog).toContainEqual(["usage_counters", "eq:user_id", "user-1"]);
    expect(queryLog).toContainEqual(["scores", "in:attempt_id", [attemptId]]);
    expect(queryLog).toContainEqual(["revision_events", "in:session_id", [sessionId]]);
    expect(queryLog).toContainEqual(["ai_jobs", "in:attempt_id", [attemptId]]);
  });
});

function eventRpcClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as unknown as ProductEventRpcClient;
}

function privacyDependencies(authenticated = true) {
  return {
    getUser: vi.fn().mockResolvedValue(authenticated ? { id: "user-1" } : null),
    loadTrainingData: vi.fn().mockResolvedValue({
      schemaVersion: "stg-training-export-v2",
      exportedAt: "2026-07-20T00:00:00.000Z",
      profile: null,
      attempts: [],
      scores: [],
      feedback: [],
      sessions: [],
      revisions: [],
      productEvents: [],
      usageCounters: [],
      aiJobs: []
    }),
    deleteOwnTrainingData: vi.fn().mockResolvedValue({
      deleted: true,
      sessions: 1,
      attempts: 2,
      events: 6
    }),
    signOut: vi.fn().mockResolvedValue(undefined)
  } satisfies DataPrivacyApiDependencies;
}

function fakePrivacyClient(queryLog: Array<[string, string, unknown]>) {
  const tables: Record<string, Record<string, unknown>[]> = {
    user_profiles: [
      { user_id: "user-1", target_role: "PM" },
      { user_id: "user-2", target_role: "Engineer" }
    ],
    attempts: [
      { id: attemptId, user_id: "user-1", created_at: "2026-07-20" },
      { id: "33333333-3333-4333-8333-333333333333", user_id: "user-2", created_at: "2026-07-20" }
    ],
    practice_sessions: [
      { id: sessionId, user_id: "user-1", created_at: "2026-07-20" },
      { id: "44444444-4444-4444-8444-444444444444", user_id: "user-2", created_at: "2026-07-20" }
    ],
    scores: [
      { attempt_id: attemptId, total_score: 80, created_at: "2026-07-20" },
      { attempt_id: "33333333-3333-4333-8333-333333333333", total_score: 90, created_at: "2026-07-20" }
    ],
    ai_feedback: [
      { attempt_id: attemptId, diagnosis: [], created_at: "2026-07-20" },
      { attempt_id: "33333333-3333-4333-8333-333333333333", diagnosis: [], created_at: "2026-07-20" }
    ],
    revision_events: [
      { session_id: sessionId, action: "accepted", created_at: "2026-07-20" },
      { session_id: "44444444-4444-4444-8444-444444444444", action: "edited", created_at: "2026-07-20" }
    ],
    product_events: [
      {
        user_id: "user-1",
        event_name: "draft_submitted",
        attempt_id: attemptId,
        metadata: { practice_day: 1, character_count: 180 },
        occurred_at: "2026-07-20",
        created_at: "2026-07-20"
      },
      {
        user_id: "user-2",
        event_name: "draft_submitted",
        attempt_id: "33333333-3333-4333-8333-333333333333",
        metadata: { practice_day: 1, character_count: 200 },
        occurred_at: "2026-07-20",
        created_at: "2026-07-20"
      }
    ],
    usage_counters: [
      {
        user_id: "user-1",
        usage_date: "2026-07-20",
        metric: "ai_session",
        quantity: 1,
        idempotency_keys: ["private-request-key"],
        updated_at: "2026-07-20"
      },
      {
        user_id: "user-2",
        usage_date: "2026-07-20",
        metric: "ai_session",
        quantity: 2,
        idempotency_keys: ["other-user-key"],
        updated_at: "2026-07-20"
      }
    ],
    ai_jobs: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        attempt_id: attemptId,
        stage: "analysis",
        status: "completed",
        provider: "openai",
        provider_response_id: "resp-secret",
        model: "gpt-4.1-mini",
        prompt_version: "analysis-v1",
        rubric_version: "stg-rubric-v1",
        retry_count: 0,
        max_retries: 2,
        error_code: "PROVIDER_TIMEOUT",
        error_message: "private provider error",
        request_payload: { user_answer: "private answer" },
        output_payload: { analysis: "private output" },
        lease_token: "private-lease",
        created_at: "2026-07-20",
        updated_at: "2026-07-20"
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        attempt_id: "33333333-3333-4333-8333-333333333333",
        stage: "analysis",
        status: "completed",
        provider: "openai",
        model: "gpt-4.1-mini",
        prompt_version: "analysis-v1",
        rubric_version: "stg-rubric-v1",
        retry_count: 0,
        max_retries: 2,
        created_at: "2026-07-20",
        updated_at: "2026-07-20"
      }
    ]
  };

  return {
    from(table: string) {
      return {
        select(columns: string) {
          const selectedColumns = columns.split(",").map((column) => column.trim());
          let sourceRows = [...(tables[table] ?? [])];
          const project = () =>
            sourceRows.map((row) =>
              Object.fromEntries(
                selectedColumns.flatMap((column) =>
                  column in row ? [[column, row[column]]] : []
                )
              )
            );
          const builder = {
            eq(column: string, value: unknown) {
              queryLog.push([table, `eq:${column}`, value]);
              sourceRows = sourceRows.filter((row) => row[column] === value);
              return builder;
            },
            in(column: string, values: readonly string[]) {
              queryLog.push([table, `in:${column}`, [...values]]);
              sourceRows = sourceRows.filter(
                (row) => typeof row[column] === "string" && values.includes(row[column] as string)
              );
              return builder;
            },
            order() {
              return builder;
            },
            maybeSingle() {
              return Promise.resolve({ data: project()[0] ?? null, error: null });
            },
            then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
              return Promise.resolve({ data: project(), error: null }).then(resolve, reject);
            }
          };
          return builder;
        }
      };
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  } as unknown as DataPrivacySupabaseClient;
}
