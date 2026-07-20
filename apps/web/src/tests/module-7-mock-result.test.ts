import {
  handlePostAttempt,
  type PostAttemptDependencies
} from "@/server/attempts/attemptApi";
import {
  handleGetAttemptResult,
  type GetAttemptResultDependencies
} from "@/server/attempts/attemptResultApi";
import type {
  AiFeedbackRow,
  AttemptInsert,
  AttemptQuestionRow,
  AttemptRepository,
  AttemptRow,
  AttemptStatus,
  ScoreRow
} from "@/server/attempts/types";

const activeDay1Question: AttemptQuestionRow = {
  id: "00000000-0000-4000-8000-000000000001",
  day_number: 1,
  is_active: true
};

const validShortAnswer = "我想做数据分析，因为我喜欢把复杂问题讲清楚并支持业务判断。";

function postRequest({
  answerText = validShortAnswer,
  idempotencyKey = "idem-module-7"
}: {
  answerText?: string;
  idempotencyKey?: string;
} = {}) {
  return new Request("http://localhost:3000/api/attempts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": idempotencyKey
    },
    body: JSON.stringify({
      question_id: activeDay1Question.id,
      answer_text: answerText
    })
  });
}

function getResultRequest(attemptId: string) {
  return new Request(`http://localhost:3000/api/attempts/${attemptId}/result`);
}

async function json(response: Response) {
  return response.json();
}

function createRepository(): AttemptRepository & {
  createAttemptCount: () => number;
  scoreInsertCount: () => number;
  feedbackInsertCount: () => number;
  statusTransitions: () => AttemptStatus[];
  latestScore: () => ScoreRow | null;
  latestFeedback: () => AiFeedbackRow | null;
  seedProcessingAttempt: () => void;
  seedFailedAttempt: () => void;
  seedOtherUserAttempt: () => void;
} {
  const attemptsByKey = new Map<string, AttemptRow>();
  const attemptsById = new Map<string, AttemptRow>();
  const scoresByAttemptId = new Map<string, ScoreRow>();
  const feedbackByAttemptId = new Map<string, AiFeedbackRow>();
  const transitions: AttemptStatus[] = [];
  let createAttemptCount = 0;
  let scoreInsertCount = 0;
  let feedbackInsertCount = 0;

  const repository: AttemptRepository & {
    createAttemptCount: () => number;
    scoreInsertCount: () => number;
    feedbackInsertCount: () => number;
    statusTransitions: () => AttemptStatus[];
    latestScore: () => ScoreRow | null;
    latestFeedback: () => AiFeedbackRow | null;
    seedProcessingAttempt: () => void;
    seedFailedAttempt: () => void;
    seedOtherUserAttempt: () => void;
  } = {
    async findActiveQuestionById() {
      return activeDay1Question;
    },
    async findAttemptByIdempotencyKey(userId, idempotencyKey) {
      return attemptsByKey.get(`${userId}:${idempotencyKey}`) ?? null;
    },
    async createAttempt(insert: AttemptInsert) {
      createAttemptCount += 1;
      const row: AttemptRow = {
        id: `attempt-${createAttemptCount}`,
        user_id: insert.userId,
        question_id: insert.questionId,
        day_number: activeDay1Question.day_number,
        original_answer: insert.answerText,
        status: "submitted",
        idempotency_key: insert.idempotencyKey,
        client_started_at: insert.clientStartedAt ?? null,
        created_at: "2026-06-19T00:00:00.000Z"
      };

      attemptsByKey.set(`${insert.userId}:${insert.idempotencyKey}`, row);
      attemptsById.set(row.id, row);
      transitions.push(row.status);
      return row;
    },
    async updateAttemptStatus(userId, attemptId, status) {
      const row = attemptsById.get(attemptId);

      if (!row || row.user_id !== userId) {
        throw new Error("Attempt was not found.");
      }

      const updated: AttemptRow = {
        ...row,
        status
      };

      attemptsById.set(attemptId, updated);
      attemptsByKey.set(`${updated.user_id}:${updated.idempotency_key}`, updated);
      transitions.push(status);
      return updated;
    },
    async findAttemptById(userId, attemptId) {
      const row = attemptsById.get(attemptId);
      return row && row.user_id === userId ? row : null;
    },
    async findScoreByAttemptId(attemptId) {
      return scoresByAttemptId.get(attemptId) ?? null;
    },
    async createScore(score) {
      scoreInsertCount += 1;
      const row: ScoreRow = {
        ...score,
        created_at: "2026-06-19T00:00:00.000Z"
      };
      scoresByAttemptId.set(score.attempt_id, row);
      return row;
    },
    async findAiFeedbackByAttemptId(attemptId) {
      return feedbackByAttemptId.get(attemptId) ?? null;
    },
    async createAiFeedback(feedback) {
      feedbackInsertCount += 1;
      const row: AiFeedbackRow = {
        ...feedback,
        created_at: "2026-06-19T00:00:00.000Z"
      };
      feedbackByAttemptId.set(feedback.attempt_id, row);
      return row;
    },
    createAttemptCount() {
      return createAttemptCount;
    },
    scoreInsertCount() {
      return scoreInsertCount;
    },
    feedbackInsertCount() {
      return feedbackInsertCount;
    },
    statusTransitions() {
      return transitions;
    },
    latestScore() {
      return scoresByAttemptId.get("attempt-1") ?? null;
    },
    latestFeedback() {
      return feedbackByAttemptId.get("attempt-1") ?? null;
    },
    seedProcessingAttempt() {
      attemptsById.set("processing-attempt", {
        id: "processing-attempt",
        user_id: "user-1",
        question_id: activeDay1Question.id,
        day_number: 1,
        original_answer: validShortAnswer,
        status: "analysis_running",
        idempotency_key: "processing-key",
        client_started_at: null,
        created_at: "2026-06-19T00:00:00.000Z"
      });
    },
    seedFailedAttempt() {
      attemptsById.set("failed-attempt", {
        id: "failed-attempt",
        user_id: "user-1",
        question_id: activeDay1Question.id,
        day_number: 1,
        original_answer: validShortAnswer,
        status: "failed",
        idempotency_key: "failed-key",
        client_started_at: null,
        created_at: "2026-06-19T00:00:00.000Z"
      });
    },
    seedOtherUserAttempt() {
      attemptsById.set("other-attempt", {
        id: "other-attempt",
        user_id: "other-user",
        question_id: activeDay1Question.id,
        day_number: 1,
        original_answer: validShortAnswer,
        status: "completed",
        idempotency_key: "other-key",
        client_started_at: null,
        created_at: "2026-06-19T00:00:00.000Z"
      });
    }
  };

  return repository;
}

function dependencies(repository = createRepository()):
  | (PostAttemptDependencies & { repository: ReturnType<typeof createRepository> })
  | (GetAttemptResultDependencies & { repository: ReturnType<typeof createRepository> }) {
  return {
    getUser: vi.fn().mockResolvedValue({
      id: "user-1"
    }),
    repository,
    currentDayResolver: vi.fn().mockResolvedValue(1)
  };
}

describe("Module 7 mock AI result persistence", () => {
  it("rejects answers below the minimum effective length", async () => {
    const response = await handlePostAttempt(
      postRequest({
        answerText: "Too short"
      }),
      dependencies() as PostAttemptDependencies
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "回答内容太短。请至少写出一个完整观点和简单原因。"
      }
    });
  });

  it("allows a valid short Day1 answer and completes the attempt", async () => {
    const repository = createRepository();
    const response = await handlePostAttempt(
      postRequest(),
      dependencies(repository) as PostAttemptDependencies
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      ok: true,
      data: {
        attempt: {
          id: "attempt-1",
          status: "completed"
        }
      }
    });
    expect(repository.statusTransitions()).toEqual([
      "submitted",
      "mock_result_generating",
      "completed"
    ]);
  });

  it("saves deterministic score and feedback records", async () => {
    const repository = createRepository();
    await handlePostAttempt(
      postRequest(),
      dependencies(repository) as PostAttemptDependencies
    );

    const score = repository.latestScore();
    const feedback = repository.latestFeedback();

    expect(score).toMatchObject({
      attempt_id: "attempt-1",
      answer_relevance: 15,
      core_message: 12,
      structure: 16,
      evidence: 13,
      interview_impact: 12,
      total_score: 68
    });
    expect(score?.total_score).toBe(
      score!.answer_relevance +
        score!.core_message +
        score!.structure +
        score!.evidence +
        score!.interview_impact
    );
    expect(feedback).toMatchObject({
      attempt_id: "attempt-1",
      diagnosis: [
        {
          issue_type: "late_core_message",
          severity: "medium"
        }
      ],
      rewrite: {
        rewrite_goal: "把核心原因提前，并保留原回答中的真实信息。"
      },
      growth_suggestion: {
        focus_for_next_practice: "结论先行"
      }
    });
  });

  it("returns the same persisted result on repeated reads without duplicate inserts", async () => {
    const repository = createRepository();
    await handlePostAttempt(
      postRequest(),
      dependencies(repository) as PostAttemptDependencies
    );

    const first = await handleGetAttemptResult(
      getResultRequest("attempt-1"),
      {
        getUser: async () => ({ id: "user-1" }),
        repository
      }
    );
    const second = await handleGetAttemptResult(
      getResultRequest("attempt-1"),
      {
        getUser: async () => ({ id: "user-1" }),
        repository
      }
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await json(first)).data.result).toEqual((await json(second)).data.result);
    expect(repository.scoreInsertCount()).toBe(1);
    expect(repository.feedbackInsertCount()).toBe(1);
  });

  it("does not duplicate score or feedback when the same idempotency key is submitted twice", async () => {
    const repository = createRepository();

    await handlePostAttempt(
      postRequest({
        idempotencyKey: "same-key"
      }),
      dependencies(repository) as PostAttemptDependencies
    );
    await handlePostAttempt(
      postRequest({
        idempotencyKey: "same-key"
      }),
      dependencies(repository) as PostAttemptDependencies
    );

    expect(repository.createAttemptCount()).toBe(1);
    expect(repository.scoreInsertCount()).toBe(1);
    expect(repository.feedbackInsertCount()).toBe(1);
  });

  it("does not let a user read another user's attempt result", async () => {
    const repository = createRepository();
    repository.seedOtherUserAttempt();

    const response = await handleGetAttemptResult(getResultRequest("other-attempt"), {
      getUser: async () => ({ id: "user-1" }),
      repository
    });

    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "NOT_FOUND"
      }
    });
  });

  it("returns a retryable failed result without score or feedback", async () => {
    const repository = createRepository();
    repository.seedFailedAttempt();

    const response = await handleGetAttemptResult(
      getResultRequest("failed-attempt"),
      {
        getUser: async () => ({ id: "user-1" }),
        repository
      }
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      ok: true,
      data: {
        result: {
          attempt: {
            status: "failed",
            retryAvailable: true
          }
        }
      }
    });
  });

  it("returns a polling state instead of 404 while an attempt is processing", async () => {
    const repository = createRepository();
    repository.seedProcessingAttempt();

    const response = await handleGetAttemptResult(
      getResultRequest("processing-attempt"),
      {
        getUser: async () => ({ id: "user-1" }),
        repository
      }
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      ok: true,
      data: {
        result: {
          attempt: {
            status: "analysis_running",
            retryAfterMs: 1500
          }
        }
      }
    });
  });
});
