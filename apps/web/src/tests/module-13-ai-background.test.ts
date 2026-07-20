import { readFileSync } from "node:fs";
import { join } from "node:path";

import { GET as reconcileGet } from "@/app/api/internal/ai/reconcile/route";
import { createBackgroundAiPipeline } from "@/server/ai/backgroundPipeline";
import { resolveFeedbackLanguage } from "@/server/ai/feedbackLanguage";
import {
  createAiJobReconcileService,
  type AiJob,
  type AiJobRepository,
  type ClaimedAiJob
} from "@/server/ai/jobs";
import {
  buildOpenAiRequestOptions,
  buildOpenAiResponseParams
} from "@/server/ai/openaiClient";
import type { StgBackgroundAiClient } from "@/server/ai/types";
import type {
  AttemptQuestionRow,
  AttemptRepository,
  AttemptRow
} from "@/server/attempts";
import { AnalysisStructuredOutput } from "@/schemas/ai";

const question: AttemptQuestionRow = {
  id: "00000000-0000-4000-8000-000000000001",
  day_number: 1,
  is_active: true,
  title: "Conclusion First",
  prompt: "Why this role?",
  expected_structure: "Conclusion first"
};

const attempt: AttemptRow = {
  id: "00000000-0000-4000-8000-000000000101",
  user_id: "00000000-0000-4000-8000-000000000010",
  question_id: question.id,
  day_number: 1,
  original_answer:
    "I want to work in analytics because I enjoy turning complex questions into clear decisions.",
  status: "submitted",
  idempotency_key: "background-test",
  client_started_at: null,
  created_at: "2026-07-20T00:00:00.000Z"
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Module 13 AI background infrastructure", () => {
  it("uses strict Structured Outputs instead of JSON mode", () => {
    const parameters = buildOpenAiResponseParams(
      {
        system: "system",
        user: "user",
        model: "gpt-4.1-mini",
        temperature: 0,
        timeoutMs: 30_000,
        output: AnalysisStructuredOutput
      },
      true
    );

    expect(parameters).toMatchObject({
      background: true,
      text: {
        format: {
          type: "json_schema",
          name: AnalysisStructuredOutput.name,
          strict: true
        }
      }
    });
    expect(JSON.stringify(parameters)).not.toContain("json_object");
    expect(
      buildOpenAiRequestOptions({
        system: "system",
        user: "user",
        model: "gpt-4.1-mini",
        temperature: 0,
        timeoutMs: 30_000,
        output: AnalysisStructuredOutput,
        idempotencyKey: "stg-ai-job-fixed"
      })
    ).toMatchObject({ idempotencyKey: "stg-ai-job-fixed" });
  });

  it.each([
    ["纯中文回答会跟随中文。", undefined, "zh"],
    ["A fully English answer follows English.", undefined, "en"],
    ["A fully English answer uses the Chinese product version.", "zh", "zh"],
    ["我 used SQL 分析数据", "zh", "zh"],
    ["我 used SQL 分析数据", "en", "en"]
  ] as const)(
    "keeps the configured product language: %s / %s -> %s",
    (answer, preference, expected) => {
      expect(resolveFeedbackLanguage(answer, preference)).toBe(expected);
    }
  );

  it("allows exactly one background repair pass and never repairs a repair", async () => {
    const repository = createAttemptRepository();
    const jobs = createJobRepository();
    const aiClient = createBackgroundClient();
    const pipeline = createBackgroundAiPipeline({
      attemptRepository: repository,
      jobRepository: jobs.repository,
      aiClient: aiClient.client,
      model: "gpt-4.1-mini",
      timeoutMs: 30_000
    });

    await pipeline.enqueueInitial({
      userId: attempt.user_id,
      attempt,
      question,
      profileContext: {
        targetRole: "Data analyst",
        trainingGoal: "Clear interview answers",
        preferredAnswerLanguage: "zh"
      }
    });
    await pipeline.resultHandler.onCompleted(jobs.claimed[0], {
      responseId: "resp-analysis",
      status: "completed",
      model: "gpt-4.1-mini",
      text: "not-json",
      errorCode: null
    });

    expect(jobs.claimed.map((job) => job.stage)).toEqual([
      "analysis",
      "repair"
    ]);
    expect(aiClient.started).toHaveLength(2);
    expect(jobs.completed).toHaveLength(1);

    await pipeline.resultHandler.onCompleted(jobs.claimed[1], {
      responseId: "resp-repair",
      status: "completed",
      model: "gpt-4.1-mini",
      text: "still-not-json",
      errorCode: null
    });

    expect(aiClient.started).toHaveLength(2);
    expect(jobs.failed).toEqual([
      expect.objectContaining({
        jobId: jobs.claimed[1].id,
        errorCode: "INVALID_PROVIDER_JSON_AFTER_REPAIR"
      })
    ]);
  });

  it("recovers a crash after Provider acceptance with the same durable request key", async () => {
    const repository = createAttemptRepository();
    const jobs = createJobRepository({ attachFailures: 1 });
    const aiClient = createBackgroundClient();
    const pipeline = createBackgroundAiPipeline({
      attemptRepository: repository,
      jobRepository: jobs.repository,
      aiClient: aiClient.client,
      model: "gpt-4.1-mini",
      timeoutMs: 30_000
    });

    await pipeline.enqueueInitial({
      userId: attempt.user_id,
      attempt,
      question
    });
    expect(jobs.claimed[0].status).toBe("queued");
    expect(jobs.claimed[0].requestPayload.user).toContain(
      attempt.original_answer
    );
    expect(jobs.attached).toHaveLength(0);

    jobs.reconcileCandidates.push(jobs.claimed[0]);
    const reconciler = createAiJobReconcileService({
      repository: jobs.repository,
      provider: aiClient.client,
      resultHandler: pipeline.resultHandler
    });
    const summary = await reconciler.reconcile({ staleAfterMs: 0 });

    expect(summary).toMatchObject({ claimed: 1, pending: 1 });
    expect(jobs.attached).toHaveLength(1);
    expect(aiClient.started).toHaveLength(2);
    expect(aiClient.started[0].idempotencyKey).toBe(
      jobs.claimed[0].providerIdempotencyKey
    );
    expect(aiClient.started[1].idempotencyKey).toBe(
      aiClient.started[0].idempotencyKey
    );
  });

  it("atomically persists the next queued stage before its Provider call", async () => {
    const repository = createAttemptRepository();
    const jobs = createJobRepository();
    const aiClient = createBackgroundClient({ failOnStartNumbers: [2] });
    const pipeline = createBackgroundAiPipeline({
      attemptRepository: repository,
      jobRepository: jobs.repository,
      aiClient: aiClient.client,
      model: "gpt-4.1-mini",
      timeoutMs: 30_000
    });

    await pipeline.enqueueInitial({
      userId: attempt.user_id,
      attempt,
      question
    });
    await pipeline.resultHandler.onCompleted(jobs.claimed[0], {
      responseId: "resp-analysis",
      status: "completed",
      model: "gpt-4.1-mini",
      text: JSON.stringify({ invalid: true }),
      errorCode: null
    });

    expect(jobs.atomicTransitions).toHaveLength(1);
    expect(jobs.atomicTransitions[0]).toMatchObject({
      jobId: jobs.claimed[0].id,
      next: { stage: "repair" }
    });
    expect(jobs.claimed[1]).toMatchObject({
      stage: "repair",
      status: "queued",
      requestPayload: { model: "gpt-4.1-mini" }
    });
    expect(aiClient.started[1].idempotencyKey).toBe(
      jobs.claimed[1].providerIdempotencyKey
    );
    expect(jobs.attached).toHaveLength(1);

    jobs.reconcileCandidates.push(jobs.claimed[1]);
    const reconciler = createAiJobReconcileService({
      repository: jobs.repository,
      provider: aiClient.client,
      resultHandler: pipeline.resultHandler
    });
    await reconciler.reconcile({ staleAfterMs: 0 });

    expect(aiClient.started).toHaveLength(3);
    expect(aiClient.started[2].idempotencyKey).toBe(
      jobs.claimed[1].providerIdempotencyKey
    );
    expect(jobs.attached).toHaveLength(2);
  });

  it("does not expose an active lease to a concurrent duplicate enqueue", async () => {
    const repository = createAttemptRepository();
    const jobs = createJobRepository();
    const aiClient = createBackgroundClient();
    const pipeline = createBackgroundAiPipeline({
      attemptRepository: repository,
      jobRepository: jobs.repository,
      aiClient: aiClient.client,
      model: "gpt-4.1-mini",
      timeoutMs: 30_000
    });

    await pipeline.enqueueInitial({ userId: attempt.user_id, attempt, question });
    await pipeline.enqueueInitial({ userId: attempt.user_id, attempt, question });

    expect(jobs.claimed).toHaveLength(1);
    expect(aiClient.started).toHaveLength(1);
  });

  it("lets Vercel Cron call GET and safely skips when background AI is disabled", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    vi.stubEnv("STG_AI_MODE", "mock");
    vi.stubEnv("STG_AI_EXECUTION_MODE", "sync");

    const response = await reconcileGet(
      new Request("http://localhost/api/internal/ai/reconcile", {
        headers: { authorization: "Bearer cron-test-secret" }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        outcome: "skipped",
        reason: "background_ai_disabled"
      }
    });
  });

  it("defines atomic session creation and returns session_id from AI completion", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "src/database/migrations/202607200001_add_beta_ai_infrastructure.sql"
      ),
      "utf8"
    );

    expect(migration).toContain("create or replace function public.complete_ai_attempt");
    expect(migration).toContain("insert into public.practice_sessions");
    expect(migration).toContain("'ai-attempt:' || p_attempt_id::text");
    expect(migration).toContain("'session_id', v_session.id");
    expect(migration).toContain("v_job.prompt_version like '%:rescore'");
    expect(migration).toContain("provider_idempotency_key");
    expect(migration).toContain("request_payload jsonb not null");
    expect(migration).toContain("complete_ai_job_stage_and_enqueue");
    expect(migration).toContain(
      "ai_jobs.status in ('queued', 'submitted', 'in_progress')"
    );
    expect(migration).toContain(
      "ai_jobs.status in ('failed', 'cancelled')"
    );
    expect(migration).toContain(
      "v_job.retry_count >= v_job.max_retries"
    );
    expect(migration).toContain(
      "add column if not exists rubric_version text not null default 'stg-rubric-v1'"
    );
    expect(migration).toContain(
      "analysis_prompt_version = initial_attempt.analysis_prompt_version"
    );
    expect(migration).toContain("ai_model = initial_attempt.ai_model");
    expect(migration).toContain(
      "rubric_version = initial_attempt.rubric_version"
    );
  });
});

function createAttemptRepository(): AttemptRepository {
  return {
    async findActiveQuestionById() {
      return question;
    },
    async findAttemptByIdempotencyKey() {
      return null;
    },
    async createAttempt() {
      return attempt;
    },
    async updateAttemptStatus(_userId, _attemptId, status) {
      return { ...attempt, status };
    },
    async findAttemptById() {
      return attempt;
    },
    async findScoreByAttemptId() {
      return null;
    },
    async createScore() {
      throw new Error("not used");
    },
    async findAiFeedbackByAttemptId() {
      return null;
    },
    async createAiFeedback() {
      throw new Error("not used");
    }
  };
}

function createJobRepository({ attachFailures = 0 } = {}) {
  const claimed: ClaimedAiJob[] = [];
  const completed: Array<{ jobId: string }> = [];
  const atomicTransitions: Array<
    Parameters<AiJobRepository["completeAndClaimNext"]>[0]
  > = [];
  const failed: Array<Parameters<AiJobRepository["fail"]>[0]> = [];
  const attached: Array<{ jobId: string; providerResponseId: string }> = [];
  const reconcileCandidates: ClaimedAiJob[] = [];

  const repository: AiJobRepository = {
    async claim(input) {
      if (
        claimed.some(
          (job) => job.stage === input.stage && job.status === "queued"
        )
      ) {
        return null;
      }
      const job: ClaimedAiJob = {
        id: `job-${claimed.length + 1}`,
        userId: attempt.user_id,
        attemptId: input.attemptId,
        stage: input.stage,
        status: "queued",
        provider: "openai",
        providerResponseId: null,
        providerIdempotencyKey: `stg-ai-job-job-${claimed.length + 1}`,
        requestPayload: input.requestPayload,
        model: input.model,
        promptVersion: input.promptVersion,
        rubricVersion: input.rubricVersion,
        retryCount: 0,
        maxRetries: 2,
        leaseToken: `00000000-0000-4000-8000-00000000000${claimed.length + 1}`,
        leaseExpiresAt: "2026-07-20T00:02:00.000Z",
        errorCode: null,
        updatedAt: "2026-07-20T00:00:00.000Z"
      };
      claimed.push(job);
      return job;
    },
    async attachProviderResponse(jobId, _leaseToken, providerResponseId) {
      if (attachFailures > 0) {
        attachFailures -= 1;
        throw new Error("simulated attach crash");
      }
      attached.push({ jobId, providerResponseId });
      return mapJob(
        claimed.find((job) => job.id === jobId)!,
        { providerResponseId, status: "submitted" }
      );
    },
    async claimByProviderResponseId() {
      return null;
    },
    async claimReconcileCandidates() {
      return reconcileCandidates.splice(0);
    },
    async fail(input) {
      failed.push(input);
      return mapJob(
        claimed.find((job) => job.id === input.jobId)!,
        { status: "failed", errorCode: input.errorCode }
      );
    },
    async completeStage(input) {
      completed.push({ jobId: input.jobId });
      return mapJob(
        claimed.find((job) => job.id === input.jobId)!,
        { status: "completed" }
      );
    },
    async completeAndClaimNext(input) {
      atomicTransitions.push(input);
      completed.push({ jobId: input.jobId });
      const nextJob: ClaimedAiJob = {
        id: `job-${claimed.length + 1}`,
        userId: attempt.user_id,
        attemptId: attempt.id,
        stage: input.next.stage,
        status: "queued",
        provider: "openai",
        providerResponseId: null,
        providerIdempotencyKey: `stg-ai-job-job-${claimed.length + 1}`,
        requestPayload: input.next.requestPayload,
        model: input.next.model,
        promptVersion: input.next.promptVersion,
        rubricVersion: input.next.rubricVersion,
        retryCount: 0,
        maxRetries: 2,
        leaseToken: `00000000-0000-4000-8000-00000000000${claimed.length + 1}`,
        leaseExpiresAt: "2026-07-20T00:02:00.000Z",
        errorCode: null,
        updatedAt: "2026-07-20T00:00:00.000Z"
      };
      claimed.push(nextJob);
      return nextJob;
    },
    async getCompletedStageOutput() {
      return null;
    }
  };

  return {
    repository,
    claimed,
    completed,
    atomicTransitions,
    failed,
    attached,
    reconcileCandidates
  };
}

function createBackgroundClient({
  failOnStartNumbers = []
}: {
  failOnStartNumbers?: number[];
} = {}) {
  const started: Parameters<StgBackgroundAiClient["startBackgroundJson"]>[0][] = [];
  const failures = new Set(failOnStartNumbers);
  const client: StgBackgroundAiClient = {
    async generateJson() {
      throw new Error("not used");
    },
    async startBackgroundJson(input) {
      started.push(input);
      if (failures.delete(started.length)) {
        throw new Error("simulated Provider submission crash");
      }
      return {
        responseId: `resp-${started.length}`,
        status: "queued",
        model: input.model
      };
    },
    async retrieveBackgroundJson() {
      throw new Error("not used");
    }
  };
  return { client, started };
}

function mapJob(job: ClaimedAiJob, patch: Partial<AiJob>): AiJob {
  return { ...job, ...patch };
}
