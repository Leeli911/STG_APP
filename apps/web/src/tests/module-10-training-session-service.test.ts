import {
  createTrainingSessionService,
  TrainingSessionServiceError,
  type AttemptServiceFactory
} from "@/server/training-sessions/trainingSessionService";
import type {
  CommitRevisionRepositoryInput,
  CommitRevisionRepositoryOutcome,
  CreatePracticeSessionInput,
  TrainingSessionRepository
} from "@/server/training-sessions/trainingSessionRepository";
import type {
  AiFeedbackInsert,
  AiFeedbackRow,
  AttemptInsert,
  AttemptQuestionRow,
  AttemptRepository,
  AttemptRow,
  AttemptStatus,
  ScoreInsert,
  ScoreRow
} from "@/server/attempts";
import type {
  PracticeSessionRow,
  RevisionEventRow
} from "@/server/training-sessions";
import { validateRevisionDecision } from "@/lib/validation/revision";

const userId = "00000000-0000-4000-8000-000000000010";
const otherUserId = "00000000-0000-4000-8000-000000000011";
const questionId = "00000000-0000-4000-8000-000000000001";
const initialAttemptId = "00000000-0000-4000-8000-000000000101";

const question: AttemptQuestionRow = {
  id: questionId,
  day_number: 1,
  is_active: true
};

const initialAttempt: AttemptRow = {
  id: initialAttemptId,
  user_id: userId,
  question_id: questionId,
  day_number: 1,
  original_answer:
    "我想做数据分析，因为我喜欢把复杂问题讲清楚并支持业务判断。",
  status: "completed",
  idempotency_key: "initial-attempt-key",
  client_started_at: null,
  created_at: "2026-06-24T00:00:00.000Z",
  analysis_prompt_version: "analysis-v1",
  coaching_prompt_version: "coaching-v1",
  ai_model: "model-v1",
  rubric_version: "stg-rubric-v1"
};

const initialScore: ScoreRow = {
  attempt_id: initialAttemptId,
  answer_relevance: 15,
  core_message: 12,
  structure: 16,
  evidence: 13,
  interview_impact: 12,
  total_score: 68,
  rubric_evidence: {
    dimension_scores: [
      dimension("relevance", 15, 20, "回答与题目相关。"),
      dimension("core_message", 12, 20, "核心原因清晰。"),
      dimension("structure", 16, 25, "结构基本完整。"),
      dimension("evidence", 13, 20, "缺少具体经历。"),
      dimension("interview_impact", 12, 15, "表达可以理解。")
    ]
  },
  created_at: "2026-06-24T00:00:01.000Z"
};

const initialFeedback: AiFeedbackRow = {
  attempt_id: initialAttemptId,
  diagnosis: [
    {
      issue_type: "lack_example",
      severity: "medium",
      evidence: "回答没有提供具体经历。",
      why_it_matters: "面试官无法判断动机是否来自真实经历。",
      fix_direction: "补充一个真实学习或工作场景。"
    }
  ],
  rewrite: {
    rewrite_goal: "把动机表达得更具体。",
    structure_used: "Conclusion First + Supporting Reason",
    text:
      "我想做数据分析，是因为我喜欢把复杂问题讲清楚，并用分析结果支持业务判断。过去的学习经历让我确认，我希望持续提升这项能力。",
    fact_preservation_note: "没有新增用户未提供的事实。"
  },
  why_better: [
    {
      changed_what: "让核心原因更集中。",
      why_changed: "原回答原因偏短。",
      impact: "面试官能更快理解动机。"
    }
  ],
  growth_suggestion: {
    focus_for_next_practice: "结论先行",
    micro_drill: "先写一句直接回答问题的话。",
    example_sentence_frame: "我想做这份工作，主要因为……",
    estimated_next_level: "Level 1"
  },
  created_at: "2026-06-24T00:00:02.000Z"
};

describe("Module 10 TrainingSessionService", () => {
  it("shares exact accepted, rejected, and edited final-answer validation", () => {
    expect(
      validateRevisionDecision({
        action: "accepted",
        editedText: null,
        draftText: initialAttempt.original_answer,
        suggestionText: initialFeedback.rewrite.text
      })
    ).toEqual({
      ok: true,
      value: {
        action: "accepted",
        editedText: null,
        finalText: initialFeedback.rewrite.text
      }
    });
    expect(
      validateRevisionDecision({
        action: "rejected",
        editedText: null,
        draftText: initialAttempt.original_answer,
        suggestionText: initialFeedback.rewrite.text
      })
    ).toEqual({
      ok: true,
      value: {
        action: "rejected",
        editedText: null,
        finalText: initialAttempt.original_answer
      }
    });

    const editedText =
      "  我想做数据分析，因为我擅长梳理复杂问题，也希望用清晰的分析支持业务团队做出更好的判断。  ";
    expect(
      validateRevisionDecision({
        action: "edited",
        editedText,
        draftText: initialAttempt.original_answer,
        suggestionText: initialFeedback.rewrite.text
      })
    ).toEqual({
      ok: true,
      value: {
        action: "edited",
        editedText: editedText.trim(),
        finalText: editedText.trim()
      }
    });
  });

  it.each([
    ["empty", "", "edited_text cannot be empty."],
    ["same draft", ` ${initialAttempt.original_answer} `, "edited_text must differ from the draft."],
    ["same suggestion", ` ${initialFeedback.rewrite.text} `, "edited_text must differ from the suggestion."],
    ["too long", "分".repeat(6001), "edited_text must be 6000 characters or fewer."],
    ["too short", "太短", "回答内容太短。请至少写出一个完整观点和简单原因。"]
  ])("rejects an %s Edit before persistence", (_case, editedText, message) => {
    expect(
      validateRevisionDecision({
        action: "edited",
        editedText,
        draftText: initialAttempt.original_answer,
        suggestionText: initialFeedback.rewrite.text
      })
    ).toEqual({
      ok: false,
      field: "edited_text",
      message
    });
  });

  it("creates one fixed-D session and replays create idempotently", async () => {
    const fixture = createFixture();

    const first = await fixture.service.createSession({
      userId,
      initialAttemptId,
      idempotencyKey: "create-session-key"
    });
    const replay = await fixture.service.createSession({
      userId,
      initialAttemptId,
      idempotencyKey: "create-session-key"
    });

    expect(first.id).toBe(replay.id);
    expect(first).toMatchObject({
      sourceMode: "live",
      feedbackMode: "D",
      promptVersion: "analysis-v1|coaching-v1",
      rubricVersion: "stg-rubric-v1",
      modelVersion: "model-v1",
      status: "feedback_ready",
      decision: null,
      final: null,
      scoreAfter: null,
      delta: null
    });
    expect(fixture.sessions.createCount).toBe(1);
  });

  it("returns the existing session when the initial attempt uses a new create key", async () => {
    const fixture = createFixture();
    const first = await createSession(fixture);

    const replay = await fixture.service.createSession({
      userId,
      initialAttemptId,
      idempotencyKey: "another-create-key"
    });

    expect(replay.id).toBe(first.id);
    expect(fixture.sessions.createCount).toBe(1);
  });

  it("rejects reuse of a create key for a different initial attempt", async () => {
    const fixture = createFixture();
    await fixture.sessions.create({
      userId,
      initialAttemptId: "00000000-0000-4000-8000-000000000102",
      idempotencyKey: "shared-create-key",
      practiceDay: 1,
      feedbackShownAt: "2026-06-24T00:04:00.000Z",
      createdAt: "2026-06-24T00:04:00.000Z"
    });

    await expect(
      fixture.service.createSession({
        userId,
        initialAttemptId,
        idempotencyKey: "shared-create-key"
      })
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_KEY_REUSED",
      status: 409
    });
    expect(fixture.sessions.createCount).toBe(1);
  });

  it("requires an owned completed attempt with score and AI feedback", async () => {
    const wrongOwner = createFixture();
    await expect(
      wrongOwner.service.createSession({
        userId: otherUserId,
        initialAttemptId,
        idempotencyKey: "create-key"
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const incomplete = createFixture({ attemptStatus: "submitted" });
    await expect(createSession(incomplete)).rejects.toMatchObject({
      code: "ATTEMPT_NOT_READY"
    });

    const missingScore = createFixture({ includeScore: false });
    await expect(createSession(missingScore)).rejects.toMatchObject({
      code: "ATTEMPT_RESULT_NOT_READY"
    });

    const missingFeedback = createFixture({ includeFeedback: false });
    await expect(createSession(missingFeedback)).rejects.toMatchObject({
      code: "ATTEMPT_RESULT_NOT_READY"
    });
  });

  it("returns the Phase B DTO for an existing session", async () => {
    const fixture = createFixture();
    const created = await createSession(fixture);

    const loaded = await fixture.service.getSession(userId, created.id);

    expect(loaded).toMatchObject({
      id: created.id,
      sourceMode: "live",
      feedbackMode: "D",
      practiceDay: 1,
      status: "feedback_ready",
      draft: {
        text: initialAttempt.original_answer,
        attemptId: initialAttemptId
      },
      diagnosis: initialFeedback.diagnosis,
      suggestion: {
        text: initialFeedback.rewrite.text
      },
      scoreBefore: {
        total: 68
      },
      decision: null,
      final: null,
      scoreAfter: null,
      delta: null
    });
  });

  it.each([
    {
      action: "accepted" as const,
      editedText: null,
      expectedText: initialFeedback.rewrite.text,
      expectedScore: 74,
      expectedSubmitCount: 1
    },
    {
      action: "rejected" as const,
      editedText: null,
      expectedText: initialAttempt.original_answer,
      expectedScore: 68,
      expectedSubmitCount: 0
    },
    {
      action: "edited" as const,
      editedText:
        "  我想做数据分析，因为我擅长梳理复杂问题，也希望用清晰的分析支持业务团队做出更好的判断。  ",
      expectedText:
        "我想做数据分析，因为我擅长梳理复杂问题，也希望用清晰的分析支持业务团队做出更好的判断。",
      expectedScore: 74,
      expectedSubmitCount: 1
    }
  ])("commits $action with the correct final-answer scoring behavior", async ({
    action,
    editedText,
    expectedText,
    expectedScore,
    expectedSubmitCount
  }) => {
    const fixture = createFixture();
    const session = await createSession(fixture);

    const result = await fixture.service.commitRevision({
      userId,
      sessionId: session.id,
      idempotencyKey: `revision-${action}`,
      action,
      editedText,
      clientDecidedAt: "2026-06-24T00:10:00.000Z"
    });

    expect(result.httpStatus).toBe(200);
    expect(result.session).toMatchObject({
      status: "completed",
      decision: {
        action,
        idempotencyKey: `revision-${action}`
      },
      final: {
        text: expectedText
      },
      scoreAfter: {
        total: expectedScore
      },
      delta: {
        total: expectedScore - 68
      }
    });
    expect(fixture.attemptService.submitCount).toBe(expectedSubmitCount);
    expect(fixture.attemptService.submittedAnswers).toEqual(
      expectedSubmitCount ? [expectedText] : []
    );
    expect(fixture.attemptService.factoryDays).toEqual(
      expectedSubmitCount ? [1] : []
    );
    expect(fixture.sessions.revisionCount).toBe(1);
    expect(fixture.attempts.finalAttemptCount()).toBe(expectedSubmitCount);
  });

  it("rejects an invalid Edit before committing a decision or re-scoring", async () => {
    const fixture = createFixture();
    const session = await createSession(fixture);

    await expect(
      fixture.service.commitRevision(
        revisionInput(
          session.id,
          "edited",
          ` ${initialAttempt.original_answer} `,
          "invalid-edit-key"
        )
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400
    });

    expect(fixture.sessions.revisionCount).toBe(0);
    expect(fixture.attempts.finalAttemptCount()).toBe(0);
    expect(fixture.attemptService.submitCount).toBe(0);
  });

  it("returns the same completed session for an identical replay", async () => {
    const fixture = createFixture();
    const session = await createSession(fixture);
    const input = revisionInput(session.id, "accepted", null, "same-key");

    const first = await fixture.service.commitRevision(input);
    const replay = await fixture.service.commitRevision(input);

    expect(replay.session).toEqual(first.session);
    expect(replay.httpStatus).toBe(200);
    expect(fixture.sessions.revisionCount).toBe(1);
    expect(fixture.attempts.finalAttemptCount()).toBe(1);
    expect(fixture.attemptService.submitCount).toBe(1);
  });

  it("recovers the crash window after the revision commits but before enqueue", async () => {
    const fixture = createFixture();
    const session = await createSession(fixture);
    const input = revisionInput(session.id, "accepted", null, "same-key");

    await fixture.sessions.commitRevision({
      userId,
      sessionId: session.id,
      idempotencyKey: input.idempotencyKey,
      action: input.action,
      editedText: input.editedText,
      clientDecidedAt: input.clientDecidedAt
    });

    const replay = await fixture.service.commitRevision(input);

    expect(replay.httpStatus).toBe(200);
    expect(replay.session.status).toBe("completed");
    expect(fixture.attemptService.submitCount).toBe(1);
    expect(fixture.sessions.revisionCount).toBe(1);
  });

  it("returns 202 without duplicate enqueue when the final attempt is already active", async () => {
    const fixture = createFixture();
    const session = await createSession(fixture);
    const input = revisionInput(session.id, "accepted", null, "same-key");

    const committed = await fixture.sessions.commitRevision({
      userId,
      sessionId: session.id,
      idempotencyKey: input.idempotencyKey,
      action: input.action,
      editedText: input.editedText,
      clientDecidedAt: input.clientDecidedAt
    });
    await fixture.attempts.updateAttemptStatus(
      userId,
      committed.finalAttemptId!,
      "rescoring"
    );

    const replay = await fixture.service.commitRevision(input);

    expect(replay.httpStatus).toBe(202);
    expect(replay.session.status).toBe("rescoring");
    expect(fixture.attemptService.submitCount).toBe(0);
    expect(fixture.sessions.revisionCount).toBe(1);
  });

  it("maps a different second decision to a 409 conflict", async () => {
    const fixture = createFixture();
    const session = await createSession(fixture);
    await fixture.service.commitRevision(
      revisionInput(session.id, "accepted", null, "first-key")
    );

    await expect(
      fixture.service.commitRevision(
        revisionInput(session.id, "rejected", null, "second-key")
      )
    ).rejects.toMatchObject({
      code: "REVISION_ALREADY_COMMITTED",
      status: 409
    } satisfies Partial<TrainingSessionServiceError>);

    expect(fixture.sessions.revisionCount).toBe(1);
    expect(fixture.attempts.finalAttemptCount()).toBe(1);
  });

  it("retries rescore_failed with the previous decision and final attempt", async () => {
    const fixture = createFixture({ failFirstRescore: true });
    const session = await createSession(fixture);
    const input = revisionInput(session.id, "accepted", null, "retry-key");

    await expect(fixture.service.commitRevision(input)).rejects.toMatchObject({
      code: "RESCORE_FAILED",
      status: 502
    });
    expect((await fixture.service.getSession(userId, session.id)).status).toBe(
      "rescore_failed"
    );

    const retried = await fixture.service.commitRevision(input);

    expect(retried.session.status).toBe("completed");
    expect(fixture.sessions.revisionCount).toBe(1);
    expect(fixture.attempts.finalAttemptCount()).toBe(1);
    expect(fixture.attemptService.submitCount).toBe(2);
    expect(fixture.attemptService.submittedAttemptIds[0]).toBe(
      fixture.attemptService.submittedAttemptIds[1]
    );
  });

  it("returns the Session to rescore_failed when a bounded retry cannot enqueue", async () => {
    const fixture = createFixture({ returnFailedRescore: true });
    const session = await createSession(fixture);

    await expect(
      fixture.service.commitRevision(
        revisionInput(session.id, "accepted", null, "bounded-retry-key")
      )
    ).rejects.toMatchObject({
      code: "RESCORE_FAILED",
      status: 502
    });

    expect((await fixture.service.getSession(userId, session.id)).status).toBe(
      "rescore_failed"
    );
  });
});

function createFixture({
  attemptStatus = "completed",
  includeScore = true,
  includeFeedback = true,
  failFirstRescore = false,
  returnFailedRescore = false
}: {
  attemptStatus?: AttemptStatus;
  includeScore?: boolean;
  includeFeedback?: boolean;
  failFirstRescore?: boolean;
  returnFailedRescore?: boolean;
} = {}) {
  const attempts = new MemoryAttemptRepository({
    attempt: {
      ...initialAttempt,
      status: attemptStatus
    },
    score: includeScore ? initialScore : null,
    feedback: includeFeedback ? initialFeedback : null
  });
  const sessions = new MemoryTrainingSessionRepository(attempts);
  const attemptService = new RecordingAttemptServiceFactory(
    attempts,
    failFirstRescore,
    returnFailedRescore
  );
  const service = createTrainingSessionService({
    sessionRepository: sessions,
    attemptRepository: attempts,
    attemptServiceFactory: attemptService.factory,
    now: () => "2026-06-24T00:05:00.000Z"
  });

  return {
    service,
    sessions,
    attempts,
    attemptService
  };
}

async function createSession(fixture: ReturnType<typeof createFixture>) {
  return fixture.service.createSession({
    userId,
    initialAttemptId,
    idempotencyKey: "create-session-key"
  });
}

function revisionInput(
  sessionId: string,
  action: "accepted" | "rejected" | "edited",
  editedText: string | null,
  idempotencyKey: string
) {
  return {
    userId,
    sessionId,
    idempotencyKey,
    action,
    editedText,
    clientDecidedAt: "2026-06-24T00:10:00.000Z"
  };
}

class MemoryTrainingSessionRepository implements TrainingSessionRepository {
  private readonly rows = new Map<string, PracticeSessionRow>();
  private readonly revisions = new Map<string, RevisionEventRow>();
  createCount = 0;

  constructor(private readonly attempts: MemoryAttemptRepository) {}

  get revisionCount() {
    return this.revisions.size;
  }

  async findById(ownerId: string, sessionId: string) {
    const row = this.rows.get(sessionId);
    return row?.user_id === ownerId ? row : null;
  }

  async findByInitialAttemptId(ownerId: string, attemptId: string) {
    return (
      [...this.rows.values()].find(
        (row) =>
          row.user_id === ownerId && row.initial_attempt_id === attemptId
      ) ?? null
    );
  }

  async findByIdempotencyKey(ownerId: string, key: string) {
    return (
      [...this.rows.values()].find(
        (row) => row.user_id === ownerId && row.idempotency_key === key
      ) ?? null
    );
  }

  async create(input: CreatePracticeSessionInput) {
    this.createCount += 1;
    const row: PracticeSessionRow = {
      id: `00000000-0000-4000-8000-${String(this.createCount).padStart(12, "0")}`,
      user_id: input.userId,
      initial_attempt_id: input.initialAttemptId,
      final_attempt_id: null,
      idempotency_key: input.idempotencyKey,
      practice_day: input.practiceDay,
      feedback_mode: "D",
      feedback_shown_at: input.feedbackShownAt,
      status: "feedback_ready",
      created_at: input.createdAt,
      completed_at: null
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findRevision(ownerId: string, sessionId: string) {
    const session = await this.findById(ownerId, sessionId);
    return session ? this.revisions.get(sessionId) ?? null : null;
  }

  async commitRevision(
    input: CommitRevisionRepositoryInput
  ): Promise<CommitRevisionRepositoryOutcome> {
    const session = await this.findById(input.userId, input.sessionId);
    if (!session) {
      return { outcome: "not_found", sessionId: input.sessionId };
    }

    const existing = this.revisions.get(input.sessionId);
    if (existing) {
      const same =
        existing.idempotency_key === input.idempotencyKey &&
        existing.action === input.action &&
        existing.edited_text === input.editedText;
      if (!same) {
        return { outcome: "conflict", sessionId: input.sessionId };
      }
      if (session.status === "rescore_failed") {
        this.rows.set(session.id, { ...session, status: "rescoring" });
        return {
          outcome: "retry_claimed",
          sessionId: session.id,
          revisionEventId: existing.id,
          finalAttemptId: session.final_attempt_id!
        };
      }
      return {
        outcome: "replayed",
        sessionId: session.id,
        revisionEventId: existing.id,
        finalAttemptId: session.final_attempt_id!,
        status: session.status
      };
    }

    const initial = await this.attempts.findAttemptById(
      input.userId,
      session.initial_attempt_id
    );
    const feedback = await this.attempts.findAiFeedbackByAttemptId(
      session.initial_attempt_id
    );
    if (!initial || !feedback) {
      throw new Error("Initial result is missing.");
    }

    if (input.action === "rejected") {
      const revision: RevisionEventRow = {
        id: `revision-${session.id}`,
        session_id: session.id,
        idempotency_key: input.idempotencyKey,
        action: input.action,
        edited_text: null,
        client_decided_at: input.clientDecidedAt,
        created_at: input.clientDecidedAt
      };
      this.revisions.set(session.id, revision);
      this.rows.set(session.id, {
        ...session,
        final_attempt_id: initial.id,
        status: "completed",
        completed_at: "2026-06-24T00:10:00.000Z"
      });
      return {
        outcome: "committed",
        sessionId: session.id,
        revisionEventId: revision.id,
        finalAttemptId: initial.id,
        status: "completed"
      };
    }

    const finalText =
      input.action === "accepted"
        ? feedback.rewrite.text
        : input.editedText!;
    const finalAttempt = this.attempts.ensureFinalAttempt(
      input.userId,
      initial,
      session.id,
      finalText,
      input.clientDecidedAt
    );
    const revision: RevisionEventRow = {
      id: `revision-${session.id}`,
      session_id: session.id,
      idempotency_key: input.idempotencyKey,
      action: input.action,
      edited_text: input.editedText,
      client_decided_at: input.clientDecidedAt,
      created_at: input.clientDecidedAt
    };
    this.revisions.set(session.id, revision);
    this.rows.set(session.id, {
      ...session,
      final_attempt_id: finalAttempt.id,
      status: "rescoring"
    });
    return {
      outcome: "committed",
      sessionId: session.id,
      revisionEventId: revision.id,
      finalAttemptId: finalAttempt.id
    };
  }

  async setRescoreOutcome(
    ownerId: string,
    sessionId: string,
    status: "completed" | "rescore_failed"
  ) {
    const session = await this.findById(ownerId, sessionId);
    if (!session) {
      throw new Error("Session was not found.");
    }
    this.rows.set(session.id, {
      ...session,
      status,
      completed_at:
        status === "completed" ? "2026-06-24T00:20:00.000Z" : null
    });
  }
}

class MemoryAttemptRepository implements AttemptRepository {
  private readonly attempts = new Map<string, AttemptRow>();
  private readonly attemptsByKey = new Map<string, AttemptRow>();
  private readonly scores = new Map<string, ScoreRow>();
  private readonly feedback = new Map<string, AiFeedbackRow>();

  constructor({
    attempt,
    score,
    feedback
  }: {
    attempt: AttemptRow;
    score: ScoreRow | null;
    feedback: AiFeedbackRow | null;
  }) {
    this.saveAttempt(attempt);
    if (score) this.scores.set(score.attempt_id, score);
    if (feedback) this.feedback.set(feedback.attempt_id, feedback);
  }

  finalAttemptCount() {
    return [...this.attempts.values()].filter(
      (item) => item.id !== initialAttemptId
    ).length;
  }

  ensureFinalAttempt(
    ownerId: string,
    original: AttemptRow,
    sessionId: string,
    answer: string,
    createdAt: string
  ) {
    const key = `revision:${sessionId}`;
    const existing = this.attemptsByKey.get(`${ownerId}:${key}`);
    if (existing) return existing;
    const row: AttemptRow = {
      ...original,
      id: `final-${sessionId}`,
      original_answer: answer,
      status: "submitted",
      idempotency_key: key,
      client_started_at: createdAt,
      created_at: createdAt
    };
    this.saveAttempt(row);
    return row;
  }

  completeFinalAttempt(attemptId: string, status: "completed" | "failed") {
    const row = this.attempts.get(attemptId)!;
    this.saveAttempt({ ...row, status });
    if (status === "completed") {
      this.scores.set(attemptId, {
        ...initialScore,
        attempt_id: attemptId,
        total_score: 74,
        core_message: 15
      });
      this.feedback.set(attemptId, {
        ...initialFeedback,
        attempt_id: attemptId,
        created_at: "2026-06-24T00:20:00.000Z"
      });
    }
  }

  private saveAttempt(row: AttemptRow) {
    this.attempts.set(row.id, row);
    this.attemptsByKey.set(`${row.user_id}:${row.idempotency_key}`, row);
  }

  async findActiveQuestionById() {
    return question;
  }
  async findAttemptByIdempotencyKey(ownerId: string, key: string) {
    return this.attemptsByKey.get(`${ownerId}:${key}`) ?? null;
  }
  async createAttempt(insert: AttemptInsert) {
    const row: AttemptRow = {
      ...initialAttempt,
      id: `created-${this.attempts.size}`,
      user_id: insert.userId,
      question_id: insert.questionId,
      original_answer: insert.answerText,
      status: "submitted",
      idempotency_key: insert.idempotencyKey,
      client_started_at: insert.clientStartedAt ?? null
    };
    this.saveAttempt(row);
    return row;
  }
  async updateAttemptStatus(ownerId: string, attemptId: string, status: AttemptStatus) {
    const row = await this.findAttemptById(ownerId, attemptId);
    if (!row) throw new Error("Attempt not found.");
    const updated = { ...row, status };
    this.saveAttempt(updated);
    return updated;
  }
  async updateAttemptPipelineMetadata(): Promise<AttemptRow> {
    throw new Error("Not used by this service test.");
  }
  async findAttemptById(ownerId: string, attemptId: string) {
    const row = this.attempts.get(attemptId);
    return row?.user_id === ownerId ? row : null;
  }
  async findScoreByAttemptId(attemptId: string) {
    return this.scores.get(attemptId) ?? null;
  }
  async createScore(score: ScoreInsert) {
    const row = { ...score, created_at: "2026-06-24T00:20:00.000Z" };
    this.scores.set(score.attempt_id, row);
    return row;
  }
  async findAiFeedbackByAttemptId(attemptId: string) {
    return this.feedback.get(attemptId) ?? null;
  }
  async createAiFeedback(feedback: AiFeedbackInsert) {
    const row = { ...feedback, created_at: "2026-06-24T00:20:00.000Z" };
    this.feedback.set(feedback.attempt_id, row);
    return row;
  }
}

class RecordingAttemptServiceFactory {
  submitCount = 0;
  submittedAnswers: string[] = [];
  submittedAttemptIds: string[] = [];
  factoryDays: number[] = [];
  private shouldFail: boolean;

  constructor(
    private readonly attempts: MemoryAttemptRepository,
    failFirst: boolean,
    private readonly returnFailed: boolean
  ) {
    this.shouldFail = failFirst;
  }

  factory: AttemptServiceFactory = (practiceDay) => {
    this.factoryDays.push(practiceDay);
    return {
      submitAttempt: async (input) => {
        this.submitCount += 1;
        this.submittedAnswers.push(String(input.answerText));
        const attempt = await this.attempts.findAttemptByIdempotencyKey(
          input.userId,
          String(input.idempotencyKey)
        );
        if (!attempt) throw new Error("Final attempt was not pre-created.");
        this.submittedAttemptIds.push(attempt.id);
        if (this.shouldFail) {
          this.shouldFail = false;
          this.attempts.completeFinalAttempt(attempt.id, "failed");
          throw new Error("AI pipeline request failed.");
        }
        if (this.returnFailed) {
          this.attempts.completeFinalAttempt(attempt.id, "failed");
          return {
            id: attempt.id,
            questionId: attempt.question_id,
            dayNumber: attempt.day_number as 1,
            answerText: attempt.original_answer,
            status: "failed" as const,
            submittedAt: attempt.created_at
          };
        }
        this.attempts.completeFinalAttempt(attempt.id, "completed");
        return {
          id: attempt.id,
          questionId: attempt.question_id,
          dayNumber: attempt.day_number as 1,
          answerText: attempt.original_answer,
          status: "completed" as const,
          submittedAt: attempt.created_at
        };
      }
    };
  };
}

function dimension(
  dimensionName: string,
  score: number,
  maxScore: number,
  evidence: string
) {
  return {
    dimension: dimensionName,
    score,
    max_score: maxScore,
    evidence,
    deductions: []
  };
}
