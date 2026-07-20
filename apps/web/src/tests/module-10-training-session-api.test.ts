import {
  handleCreateTrainingSession,
  type CreateTrainingSessionApiDependencies
} from "@/server/training-sessions/createTrainingSessionApi";
import {
  handleGetTrainingSession,
  type GetTrainingSessionApiDependencies
} from "@/server/training-sessions/getTrainingSessionApi";
import {
  handleCommitRevision,
  type CommitRevisionApiDependencies
} from "@/server/training-sessions/commitRevisionApi";
import {
  TrainingSessionServiceError,
  type TrainingSessionService
} from "@/server/training-sessions/trainingSessionService";
import type {
  CompletedTrainingSessionDto,
  FeedbackReadyTrainingSessionDto,
  RescoringTrainingSessionDto
} from "@/server/training-sessions/types";

const userId = "00000000-0000-4000-8000-000000000010";
const sessionId = "00000000-0000-4000-8000-000000000201";
const initialAttemptId = "00000000-0000-4000-8000-000000000101";
const finalAttemptId = "00000000-0000-4000-8000-000000000102";

const feedbackReadySession: FeedbackReadyTrainingSessionDto = {
  id: sessionId,
  sourceMode: "live",
  feedbackMode: "D",
  practiceDay: 1,
  promptVersion: "analysis-v1|coaching-v1",
  rubricVersion: "stg-rubric-v1",
  modelVersion: "test-model",
  status: "feedback_ready",
  draft: {
    text: "我希望通过数据分析帮助团队更清楚地理解业务问题。",
    attemptId: initialAttemptId,
    submittedAt: "2026-06-25T00:00:00.000Z"
  },
  diagnosis: [],
  suggestion: {
    text: "我希望通过数据分析拆解复杂业务问题，并帮助团队做出更清晰的判断。",
    structureUsed: "Conclusion First",
    whyBetter: []
  },
  scoreBefore: {
    total: 68,
    dimensions: []
  },
  decision: null,
  final: null,
  scoreAfter: null,
  delta: null,
  feedbackShownAt: "2026-06-25T00:01:00.000Z"
};

const completedSession: CompletedTrainingSessionDto = {
  ...feedbackReadySession,
  status: "completed",
  decision: {
    action: "accepted",
    editedText: null,
    decidedAt: "2026-06-25T00:02:00.000Z",
    idempotencyKey: "revision-key"
  },
  final: {
    text: feedbackReadySession.suggestion.text,
    attemptId: finalAttemptId,
    submittedAt: "2026-06-25T00:02:00.000Z"
  },
  scoreAfter: {
    total: 76,
    dimensions: []
  },
  delta: null
};

const rescoringSession: RescoringTrainingSessionDto = {
  ...completedSession,
  status: "rescoring",
  scoreAfter: null,
  delta: null
};

describe("Module 10 Training Session API", () => {
  it("creates a fixed-D session and returns the same DTO for an idempotent replay", async () => {
    const dependencies = createDependencies();
    const request = createSessionRequest({
      initial_attempt_id: initialAttemptId
    });

    const first = await handleCreateTrainingSession(request, dependencies);
    const replay = await handleCreateTrainingSession(
      createSessionRequest({ initial_attempt_id: initialAttemptId }),
      dependencies
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(await responseJson(first)).toMatchObject({
      ok: true,
      data: {
        session: {
          id: sessionId,
          feedbackMode: "D",
          status: "feedback_ready",
          delta: null
        }
      }
    });
    expect(await responseJson(replay)).toMatchObject({
      ok: true,
      data: { session: { id: sessionId } }
    });
    expect(dependencies.service.createSession).toHaveBeenNthCalledWith(1, {
      userId,
      initialAttemptId,
      idempotencyKey: "create-key"
    });
    expect(dependencies.service.createSession).toHaveBeenCalledTimes(2);
  });

  it("rejects missing idempotency keys, invalid attempt IDs, and client feedback modes", async () => {
    const dependencies = createDependencies();

    const missingKey = await handleCreateTrainingSession(
      createSessionRequest(
        { initial_attempt_id: initialAttemptId },
        { idempotencyKey: null }
      ),
      dependencies
    );
    const invalidAttempt = await handleCreateTrainingSession(
      createSessionRequest({ initial_attempt_id: "not-a-uuid" }),
      dependencies
    );
    const feedbackMode = await handleCreateTrainingSession(
      createSessionRequest({
        initial_attempt_id: initialAttemptId,
        feedback_mode: "D"
      }),
      dependencies
    );

    expect(missingKey.status).toBe(400);
    expect(invalidAttempt.status).toBe(400);
    expect(feedbackMode.status).toBe(400);
    expect(dependencies.service.createSession).not.toHaveBeenCalled();
  });

  it("blocks unauthenticated create, get, and revision requests", async () => {
    const dependencies = createDependencies({ authenticated: false });

    const responses = await Promise.all([
      handleCreateTrainingSession(
        createSessionRequest({ initial_attempt_id: initialAttemptId }),
        dependencies
      ),
      handleGetTrainingSession(getSessionRequest(), dependencies),
      handleCommitRevision(revisionRequest(), dependencies)
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(await responseJson(response)).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED" }
      });
    }
    expect(dependencies.service.createSession).not.toHaveBeenCalled();
    expect(dependencies.service.getSession).not.toHaveBeenCalled();
    expect(dependencies.service.commitRevision).not.toHaveBeenCalled();
  });

  it("returns the full owned TrainingSessionDto and keeps delta null", async () => {
    const dependencies = createDependencies();
    dependencies.service.getSession.mockResolvedValueOnce(completedSession);

    const response = await handleGetTrainingSession(
      getSessionRequest(),
      dependencies
    );

    expect(response.status).toBe(200);
    expect(await responseJson(response)).toMatchObject({
      ok: true,
      data: {
        session: {
          draft: feedbackReadySession.draft,
          suggestion: feedbackReadySession.suggestion,
          decision: completedSession.decision,
          final: completedSession.final,
          scoreBefore: feedbackReadySession.scoreBefore,
          scoreAfter: completedSession.scoreAfter,
          delta: null
        }
      }
    });
    expect(dependencies.service.getSession).toHaveBeenCalledWith(
      userId,
      sessionId
    );
  });

  it("does not reveal a session owned by another user", async () => {
    const dependencies = createDependencies();
    dependencies.service.getSession.mockRejectedValueOnce(
      serviceError("NOT_FOUND", "Training session was not found.", 404)
    );

    const response = await handleGetTrainingSession(
      getSessionRequest(),
      dependencies
    );

    expect(response.status).toBe(404);
    expect(await responseJson(response)).toMatchObject({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Training session was not found."
      }
    });
  });

  it.each([
    ["committed", completedSession, 200],
    ["completed replay", completedSession, 200],
    ["successful retry_claimed", completedSession, 200],
    ["already rescoring replay", rescoringSession, 202]
  ])("maps %s to HTTP %i", async (_case, session, expectedStatus) => {
    const dependencies = createDependencies();
    dependencies.service.commitRevision.mockResolvedValueOnce({
      session,
      httpStatus: expectedStatus as 200 | 202
    });

    const response = await handleCommitRevision(
      revisionRequest(),
      dependencies
    );

    expect(response.status).toBe(expectedStatus);
    expect(await responseJson(response)).toMatchObject({
      ok: true,
      data: {
        session: {
          id: sessionId,
          status: session.status,
          delta: null
        }
      }
    });
  });

  it("maps a different committed decision to 409", async () => {
    const dependencies = createDependencies();
    dependencies.service.commitRevision.mockRejectedValueOnce(
      serviceError(
        "REVISION_ALREADY_COMMITTED",
        "A different revision decision is already committed.",
        409,
        { session_id: sessionId }
      )
    );

    const response = await handleCommitRevision(
      revisionRequest({ action: "rejected", edited_text: null }),
      dependencies
    );

    expect(response.status).toBe(409);
    expect(await responseJson(response)).toMatchObject({
      ok: false,
      error: { code: "REVISION_ALREADY_COMMITTED" }
    });
  });

  it("returns sanitized 502 details when re-scoring fails", async () => {
    const dependencies = createDependencies();
    dependencies.service.commitRevision.mockRejectedValueOnce(
      serviceError("RESCORE_FAILED", "Final answer re-score failed.", 502, {
        session_id: sessionId,
        cause: "raw provider credential and SQL error"
      })
    );

    const response = await handleCommitRevision(
      revisionRequest(),
      dependencies
    );
    const body = await responseJson(response);

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "RESCORE_FAILED",
        details: { session_id: sessionId }
      }
    });
    expect(JSON.stringify(body)).not.toContain("raw provider");
  });

  it("never exposes raw persistence errors", async () => {
    const dependencies = createDependencies();
    dependencies.service.getSession.mockRejectedValueOnce(
      serviceError("DATABASE_ERROR", "Training session persistence failed.", 500, {
        cause: "relation practice_sessions does not exist"
      })
    );

    const response = await handleGetTrainingSession(
      getSessionRequest(),
      dependencies
    );
    const body = await responseJson(response);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to load training session.",
        details: {}
      }
    });
    expect(JSON.stringify(body)).not.toContain("practice_sessions");
  });

  it("rejects a revision without an idempotency key before submission", async () => {
    const dependencies = createDependencies();

    const response = await handleCommitRevision(
      revisionRequest({}, { idempotencyKey: null }),
      dependencies
    );

    expect(response.status).toBe(400);
    expect(await responseJson(response)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" }
    });
    expect(dependencies.service.commitRevision).not.toHaveBeenCalled();
  });

  it("passes the authenticated owner and exact revision payload once", async () => {
    const dependencies = createDependencies();

    await handleCommitRevision(
      revisionRequest({
        action: "edited",
        edited_text:
          "我希望通过数据分析拆解复杂业务问题，并帮助团队做出清晰、可靠的业务判断。",
        client_decided_at: "2026-06-25T00:03:00.000Z"
      }),
      dependencies
    );

    expect(dependencies.service.commitRevision).toHaveBeenCalledTimes(1);
    expect(dependencies.service.commitRevision).toHaveBeenCalledWith({
      userId,
      sessionId,
      idempotencyKey: "revision-key",
      action: "edited",
      editedText:
        "我希望通过数据分析拆解复杂业务问题，并帮助团队做出清晰、可靠的业务判断。",
      clientDecidedAt: "2026-06-25T00:03:00.000Z"
    });
  });
});

type MockTrainingSessionService = {
  [Key in keyof TrainingSessionService]: ReturnType<typeof vi.fn>;
};

function createDependencies({
  authenticated = true
}: {
  authenticated?: boolean;
} = {}): CreateTrainingSessionApiDependencies &
  GetTrainingSessionApiDependencies &
  CommitRevisionApiDependencies & {
    service: MockTrainingSessionService;
  } {
  const service: MockTrainingSessionService = {
    createSession: vi.fn().mockResolvedValue(feedbackReadySession),
    getSession: vi.fn().mockResolvedValue(feedbackReadySession),
    markFeedbackViewed: vi.fn().mockResolvedValue(feedbackReadySession),
    commitRevision: vi.fn().mockResolvedValue({
      session: completedSession,
      httpStatus: 200
    })
  };

  return {
    getUser: vi.fn().mockResolvedValue(authenticated ? { id: userId } : null),
    service
  };
}

function createSessionRequest(
  body: unknown,
  { idempotencyKey = "create-key" }: { idempotencyKey?: string | null } = {}
) {
  return jsonRequest("http://localhost:3000/api/training-sessions", body, {
    method: "POST",
    idempotencyKey
  });
}

function getSessionRequest() {
  return new Request(
    `http://localhost:3000/api/training-sessions/${sessionId}`,
    { method: "GET" }
  );
}

function revisionRequest(
  body: Record<string, unknown> = {},
  { idempotencyKey = "revision-key" }: { idempotencyKey?: string | null } = {}
) {
  return jsonRequest(
    `http://localhost:3000/api/training-sessions/${sessionId}/revision`,
    {
      action: "accepted",
      edited_text: null,
      client_decided_at: "2026-06-25T00:02:00.000Z",
      ...body
    },
    { method: "POST", idempotencyKey }
  );
}

function jsonRequest(
  url: string,
  body: unknown,
  {
    method,
    idempotencyKey
  }: { method: "POST"; idempotencyKey: string | null }
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (idempotencyKey) headers.set("x-idempotency-key", idempotencyKey);

  return new Request(url, {
    method,
    headers,
    body: JSON.stringify(body)
  });
}

async function responseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function serviceError(
  code: ConstructorParameters<typeof TrainingSessionServiceError>[0],
  message: string,
  status: number,
  details: Record<string, unknown> = {}
) {
  return new TrainingSessionServiceError(code, message, status, details);
}
