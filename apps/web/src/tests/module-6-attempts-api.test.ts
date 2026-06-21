import {
  handlePostAttempt,
  type PostAttemptDependencies
} from "@/server/attempts/attemptApi";
import type {
  AiFeedbackInsert,
  AttemptInsert,
  AttemptQuestionRow,
  AttemptRepository,
  AttemptRow,
  AttemptStatus,
  ScoreInsert
} from "@/server/attempts/types";

const activeDay1Question: AttemptQuestionRow = {
  id: "00000000-0000-4000-8000-000000000001",
  day_number: 1,
  is_active: true
};

const inactiveQuestion: AttemptQuestionRow = {
  id: "00000000-0000-4000-8000-000000000002",
  day_number: 1,
  is_active: false
};

const validAnswer =
  "I want this role because data helps me explain business decisions clearly.";

function request({
  body,
  idempotencyKey = "idem-1"
}: {
  body: unknown;
  idempotencyKey?: string | null;
}) {
  const headers = new Headers({
    "content-type": "application/json"
  });

  if (idempotencyKey) {
    headers.set("x-idempotency-key", idempotencyKey);
  }

  return new Request("http://localhost:3000/api/attempts", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

async function json(response: Response) {
  return response.json();
}

function createDependencies({
  authenticated = true,
  question = activeDay1Question
}: {
  authenticated?: boolean;
  question?: AttemptQuestionRow | null;
} = {}): PostAttemptDependencies & {
  repository: AttemptRepository & { createCount: () => number };
} {
  const attemptsByKey = new Map<string, AttemptRow>();
  const attemptsById = new Map<string, AttemptRow>();
  let createCount = 0;

  const repository: AttemptRepository & { createCount: () => number } = {
    async findActiveQuestionById() {
      return question;
    },
    async findAttemptByIdempotencyKey(userId, idempotencyKey) {
      return attemptsByKey.get(`${userId}:${idempotencyKey}`) ?? null;
    },
    async createAttempt(insert: AttemptInsert) {
      createCount += 1;
      const row: AttemptRow = {
        id: `attempt-${createCount}`,
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
      return row;
    },
    async updateAttemptStatus(userId, attemptId, status: AttemptStatus) {
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
      return updated;
    },
    async findAttemptById(userId, attemptId) {
      const row = attemptsById.get(attemptId);
      return row && row.user_id === userId ? row : null;
    },
    async findScoreByAttemptId() {
      return null;
    },
    async createScore(score: ScoreInsert) {
      return {
        ...score,
        created_at: "2026-06-19T00:00:00.000Z"
      };
    },
    async findAiFeedbackByAttemptId() {
      return null;
    },
    async createAiFeedback(feedback: AiFeedbackInsert) {
      return {
        ...feedback,
        created_at: "2026-06-19T00:00:00.000Z"
      };
    },
    createCount() {
      return createCount;
    }
  };

  return {
    getUser: vi.fn().mockResolvedValue(
      authenticated
        ? {
            id: "user-1"
          }
        : null
    ),
    repository,
    currentDayResolver: vi.fn().mockResolvedValue(1)
  };
}

describe("Module 6 POST /api/attempts", () => {
  it("returns 401 when the user is unauthenticated", async () => {
    const response = await handlePostAttempt(
      request({
        body: {
          question_id: activeDay1Question.id,
          answer_text: "My answer"
        }
      }),
      createDependencies({ authenticated: false })
    );

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "UNAUTHENTICATED"
      }
    });
  });

  it("returns 400 when answer_text is empty after trimming", async () => {
    const response = await handlePostAttempt(
      request({
        body: {
          question_id: activeDay1Question.id,
          answer_text: "   "
        }
      }),
      createDependencies()
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_ERROR"
      }
    });
  });

  it("returns 404 when question_id does not exist", async () => {
    const response = await handlePostAttempt(
      request({
        body: {
          question_id: "00000000-0000-4000-8000-000000000099",
          answer_text: validAnswer
        }
      }),
      createDependencies({ question: null })
    );

    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "NOT_FOUND"
      }
    });
  });

  it("returns 403 when question is inactive", async () => {
    const response = await handlePostAttempt(
      request({
        body: {
          question_id: inactiveQuestion.id,
          answer_text: validAnswer
        }
      }),
      createDependencies({ question: inactiveQuestion })
    );

    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "FORBIDDEN"
      }
    });
  });

  it("returns 400 when X-Idempotency-Key is missing", async () => {
    const response = await handlePostAttempt(
      request({
        body: {
          question_id: activeDay1Question.id,
          answer_text: validAnswer
        },
        idempotencyKey: null
      }),
      createDependencies()
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_ERROR"
      }
    });
  });

  it("creates an attempt for a valid answer", async () => {
    const dependencies = createDependencies();
    const response = await handlePostAttempt(
      request({
        body: {
          question_id: activeDay1Question.id,
          answer_text: validAnswer,
          client_started_at: "2026-06-19T00:00:00.000Z"
        }
      }),
      dependencies
    );

    expect(response.status).toBe(200);
    expect(dependencies.repository.createCount()).toBe(1);
    expect(await json(response)).toMatchObject({
      ok: true,
      data: {
        attempt: {
          id: "attempt-1",
          questionId: activeDay1Question.id,
          dayNumber: 1,
          answerText: validAnswer,
          status: "completed",
          submittedAt: "2026-06-19T00:00:00.000Z"
        }
      },
      meta: {
        request_id: expect.any(String)
      }
    });
  });

  it("does not create duplicate attempts for the same idempotency key", async () => {
    const dependencies = createDependencies();
    const firstRequestBody = {
      question_id: activeDay1Question.id,
      answer_text: validAnswer
    };

    const first = await handlePostAttempt(
      request({ body: firstRequestBody, idempotencyKey: "same-key" }),
      dependencies
    );
    const second = await handlePostAttempt(
      request({ body: firstRequestBody, idempotencyKey: "same-key" }),
      dependencies
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(dependencies.repository.createCount()).toBe(1);
    expect(await json(second)).toMatchObject({
      ok: true,
      data: {
        attempt: {
          id: "attempt-1"
        }
      }
    });
  });
});
