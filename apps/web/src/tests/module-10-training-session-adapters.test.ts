import {
  createDemoTrainingSessionGateway
} from "@/features/training-session/DemoAdapter";
import {
  createLiveTrainingSessionGateway,
  type TrainingSessionFetch
} from "@/features/training-session/LiveAdapter";
import {
  TrainingSessionGatewayError,
  type TrainingSessionGateway
} from "@/features/training-session/TrainingSessionGateway";
import { validateRevisionDecision } from "@/lib/validation/revision";
import type {
  CompletedTrainingSessionDto,
  FeedbackReadyTrainingSessionDto,
  RescoreFailedTrainingSessionDto,
  TrainingSessionDto
} from "@/server/training-sessions/types";
import { deriveScoreDelta } from "@/server/training-sessions/trainingSessionDto";

const initialAttemptId = "00000000-0000-4000-8000-000000000101";
const sessionId = "00000000-0000-4000-8000-000000000201";
const finalAttemptId = "00000000-0000-4000-8000-000000000102";
const decidedAt = "2026-06-25T00:03:00.000Z";

type GatewayHarness = {
  gateway: TrainingSessionGateway;
  calls?: FakeFetchCall[];
};

type GatewayHarnessOptions = {
  failFirstRescore?: boolean;
};

const harnesses: Array<[
  string,
  (options?: GatewayHarnessOptions) => GatewayHarness
]> = [
  [
    "DemoAdapter",
    (options) => ({
      gateway: createDemoTrainingSessionGateway({
        failFirstRescore: options?.failFirstRescore
      })
    })
  ],
  [
    "LiveAdapter",
    (options) => {
      const fake = createFakeTrainingSessionFetch(options);

      return {
        gateway: createLiveTrainingSessionGateway({
          fetch: fake.fetch,
          baseUrl: "http://localhost:3000"
        }),
        calls: fake.calls
      };
    }
  ]
];

describe.each(harnesses)(
  "Module 10 Training Session Gateway contract: %s",
  (_name, createHarness) => {
    it("creates a fixed-D feedback-ready session and replays create idempotently", async () => {
      const { gateway } = createHarness();

      const first = await gateway.createSession({
        initialAttemptId,
        idempotencyKey: "create-key"
      });
      const replay = await gateway.createSession({
        initialAttemptId,
        idempotencyKey: "create-key"
      });

      expect(first).toEqual(replay);
      expect(first).toMatchObject({
        id: sessionId,
        sourceMode: expect.any(String),
        feedbackMode: "D",
        status: "feedback_ready",
        draft: {
          attemptId: initialAttemptId,
          text: draftText
        },
        suggestion: {
          text: suggestionText
        },
        decision: null,
        final: null,
        scoreAfter: null,
        delta: null
      });
    });

    it.each([
      ["accepted", "accepted" as const, null, suggestionText, 82, 14],
      ["rejected", "rejected" as const, null, draftText, 68, 0],
      [
        "edited",
        "edited" as const,
        ` ${editedText} `,
        editedText,
        82,
        14
      ]
    ])(
      "commits a deterministic %s decision and returns completed final answer",
      async (
        _case,
        action,
        editedTextInput,
        expectedFinalText,
        expectedScore,
        expectedDelta
      ) => {
        const { gateway } = createHarness();
        const session = await createSession(gateway);

        const completed = await gateway.commitRevision({
          sessionId: session.id,
          idempotencyKey: `revision-${action}`,
          action,
          editedText: editedTextInput,
          clientDecidedAt: decidedAt
        });

        expect(completed).toMatchObject({
          id: session.id,
          feedbackMode: "D",
          status: "completed",
          decision: {
            action,
            editedText: action === "edited" ? editedText : null,
            decidedAt,
            idempotencyKey: `revision-${action}`
          },
          final: {
            text: expectedFinalText
          },
          scoreAfter: {
            total: expectedScore
          },
          delta: {
            total: expectedDelta
          }
        });
      }
    );

    it("replays an identical committed revision without creating a second decision", async () => {
      const { gateway } = createHarness();
      const session = await createSession(gateway);

      const first = await gateway.commitRevision(acceptedInput(session.id));
      const replay = await gateway.commitRevision(acceptedInput(session.id));

      expect(replay).toEqual(first);
      expect(replay.decision).toEqual(first.decision);
      expect(replay.final).toEqual(first.final);
    });

    it("rejects a different second decision with a typed 409 conflict", async () => {
      const { gateway } = createHarness();
      const session = await createSession(gateway);

      await gateway.commitRevision(acceptedInput(session.id));

      const conflict = gateway.commitRevision({
          sessionId: session.id,
          idempotencyKey: "revision-different",
          action: "rejected",
          editedText: null,
          clientDecidedAt: decidedAt
        });

      await expect(conflict).rejects.toBeInstanceOf(
        TrainingSessionGatewayError
      );
      await expect(conflict).rejects.toMatchObject({
        code: "REVISION_ALREADY_COMMITTED",
        status: 409
      });
    });

    it("retries a failed re-score with the same committed decision", async () => {
      const { gateway } = createHarness({ failFirstRescore: true });
      const session = await createSession(gateway);

      const failed = await gateway.commitRevision(acceptedInput(session.id));
      expect(failed).toMatchObject({
        status: "rescore_failed",
        decision: {
          action: "accepted",
          idempotencyKey: "revision-key"
        },
        final: {
          text: suggestionText
        },
        scoreAfter: null,
        delta: null
      });

      const retried = await gateway.commitRevision(acceptedInput(session.id));

      expect(retried).toMatchObject({
        status: "completed",
        decision: failed.decision,
        final: failed.final,
        scoreAfter: {
          total: 82
        },
        delta: {
          total: 14
        }
      });
    });
  }
);

describe("personalized zero-cost demo evaluation", () => {
  it("quotes the submitted answer and moves a late value statement to the front", async () => {
    const submitted =
      "团队做决策时常遇到信息分散的问题。我希望通过数据分析帮助团队看清关键问题。";
    const gateway = createDemoTrainingSessionGateway({ draftText: submitted });
    const session = await gateway.createSession({
      initialAttemptId,
      idempotencyKey: "personalized-create"
    });

    expect(session.scoreBefore.total).toBe(60);
    expect(session.diagnosis[0]?.evidence).toContain(
      "我希望通过数据分析帮助团队看清关键问题。"
    );
    expect(session.suggestion.text).toBe(
      "我希望通过数据分析帮助团队看清关键问题。团队做决策时常遇到信息分散的问题。"
    );

    const completed = await gateway.commitRevision({
      sessionId: session.id,
      idempotencyKey: "personalized-revision",
      action: "accepted",
      editedText: null,
      clientDecidedAt: decidedAt
    });

    expect(completed.status).toBe("completed");
    if (completed.status !== "completed") return;
    expect(completed.scoreAfter.total).toBe(85);
    expect(completed.delta?.total).toBe(25);
  });

  it("does not invent an ordering problem when the conclusion is already first", async () => {
    const submitted =
      "我希望通过数据分析帮助团队更快做出判断。随后我会说明判断依据。";
    const gateway = createDemoTrainingSessionGateway({ draftText: submitted });
    const session = await gateway.createSession({
      initialAttemptId,
      idempotencyKey: "already-clear-create"
    });

    expect(session.scoreBefore.total).toBe(85);
    expect(session.diagnosis[0]?.evidence).toContain("第一句话已经直接说明核心价值");
    expect(session.suggestion.text).toBe(submitted);
  });
});

describe("Module 10 Training Session Gateway adapter boundaries", () => {
  it("DemoAdapter keeps the workflow fully in memory and never calls fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("fetch must not be called by DemoAdapter"));
    const gateway = createDemoTrainingSessionGateway();
    const session = await createSession(gateway);

    await gateway.commitRevision(acceptedInput(session.id));
    await gateway.getSession(session.id);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("LiveAdapter calls only the three Training Session API endpoints", async () => {
    const fake = createFakeTrainingSessionFetch();
    const gateway = createLiveTrainingSessionGateway({
      fetch: fake.fetch,
      baseUrl: "http://localhost:3000"
    });

    const session = await createSession(gateway);
    await gateway.getSession(session.id);
    await gateway.commitRevision(acceptedInput(session.id));

    expect(fake.calls.map((call) => [call.method, call.pathname])).toEqual([
      ["POST", "/api/training-sessions"],
      ["GET", `/api/training-sessions/${session.id}`],
      ["POST", `/api/training-sessions/${session.id}/revision`]
    ]);
    expect(fake.calls.every((call) =>
      call.pathname.startsWith("/api/training-sessions")
    )).toBe(true);
    expect(fake.calls[0]?.headers.get("x-idempotency-key")).toBe("create-key");
    expect(fake.calls[2]?.headers.get("x-idempotency-key")).toBe("revision-key");
  });
});

function createSession(gateway: TrainingSessionGateway) {
  return gateway.createSession({
    initialAttemptId,
    idempotencyKey: "create-key"
  });
}

function acceptedInput(sessionIdValue: string) {
  return {
    sessionId: sessionIdValue,
    idempotencyKey: "revision-key",
    action: "accepted" as const,
    editedText: null,
    clientDecidedAt: decidedAt
  };
}

type FakeFetchCall = {
  method: string;
  pathname: string;
  headers: Headers;
  body: Record<string, unknown> | null;
};

function createFakeTrainingSessionFetch({
  failFirstRescore = false
}: GatewayHarnessOptions = {}) {
  let session: TrainingSessionDto | null = null;
  let createKey: string | null = null;
  let failedOnce = false;
  const calls: FakeFetchCall[] = [];

  const fetch: TrainingSessionFetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const method = init?.method ?? "GET";
    const body = readBody(init?.body);
    calls.push({
      method,
      pathname: url.pathname,
      headers,
      body
    });

    if (method === "POST" && url.pathname === "/api/training-sessions") {
      if (createKey && createKey !== headers.get("x-idempotency-key")) {
        return apiError("IDEMPOTENCY_KEY_REUSED", 409);
      }
      createKey = headers.get("x-idempotency-key");
      session ??= createFeedbackReadySession("live", body?.initial_attempt_id);
      return apiSuccess({ session });
    }

    const sessionMatch = url.pathname.match(
      /^\/api\/training-sessions\/([^/]+)$/
    );
    if (method === "GET" && sessionMatch) {
      return session ? apiSuccess({ session }) : apiError("NOT_FOUND", 404);
    }

    const revisionMatch = url.pathname.match(
      /^\/api\/training-sessions\/([^/]+)\/revision$/
    );
    if (method === "POST" && revisionMatch) {
      if (!session) return apiError("NOT_FOUND", 404);

      const next = commitFakeRevision({
        session,
        idempotencyKey: headers.get("x-idempotency-key") ?? "",
        action: body?.action,
        editedText: body?.edited_text,
        clientDecidedAt: body?.client_decided_at,
        failFirstRescore,
        failedOnce
      });
      failedOnce = failedOnce || next.failedThisAttempt;
      session = next.session;

      if (next.conflict) {
        return apiError("REVISION_ALREADY_COMMITTED", 409, {
          session_id: session.id
        });
      }
      if (next.failedThisAttempt) {
        return apiError("RESCORE_FAILED", 502, {
          session_id: session.id
        });
      }

      return apiSuccess({ session });
    }

    return apiError("NOT_FOUND", 404);
  };

  return { fetch, calls };
}

function commitFakeRevision({
  session,
  idempotencyKey,
  action,
  editedText,
  clientDecidedAt,
  failFirstRescore,
  failedOnce
}: {
  session: TrainingSessionDto;
  idempotencyKey: string;
  action: unknown;
  editedText: unknown;
  clientDecidedAt: unknown;
  failFirstRescore: boolean;
  failedOnce: boolean;
}): {
  session: TrainingSessionDto;
  conflict: boolean;
  failedThisAttempt: boolean;
} {
  if (session.decision) {
    const same =
      session.decision.idempotencyKey === idempotencyKey &&
      session.decision.action === action &&
      session.decision.editedText === (editedText ?? null);

    if (!same) {
      return { session, conflict: true, failedThisAttempt: false };
    }

    if (session.status === "rescore_failed") {
      return {
        session: completeSession(session),
        conflict: false,
        failedThisAttempt: false
      };
    }

    return { session, conflict: false, failedThisAttempt: false };
  }

  const validated = validateRevisionDecision({
    action,
    editedText,
    draftText: session.draft.text,
    suggestionText: session.suggestion.text
  });

  if (!validated.ok) {
    return { session, conflict: true, failedThisAttempt: false };
  }

  const withDecision = addDecision(session, {
    idempotencyKey,
    action: validated.value.action,
    editedText: validated.value.editedText,
    finalText: validated.value.finalText,
    clientDecidedAt:
      typeof clientDecidedAt === "string" ? clientDecidedAt : decidedAt
  });

  if (validated.value.action === "rejected") {
    return {
      session: completeSession(withDecision),
      conflict: false,
      failedThisAttempt: false
    };
  }

  if (failFirstRescore && !failedOnce) {
    return {
      session: {
        ...withDecision,
        status: "rescore_failed",
        scoreAfter: null,
        delta: null
      },
      conflict: false,
      failedThisAttempt: true
    };
  }

  return {
    session: completeSession(withDecision),
    conflict: false,
    failedThisAttempt: false
  };
}

function addDecision(
  session: FeedbackReadyTrainingSessionDto,
  input: {
    idempotencyKey: string;
    action: "accepted" | "rejected" | "edited";
    editedText: string | null;
    finalText: string;
    clientDecidedAt: string;
  }
): RescoreFailedTrainingSessionDto {
  return {
    ...session,
    status: "rescore_failed",
    decision: {
      action: input.action,
      editedText: input.editedText,
      decidedAt: input.clientDecidedAt,
      idempotencyKey: input.idempotencyKey
    },
    final: {
      text: input.finalText,
      attemptId: finalAttemptId,
      submittedAt: input.clientDecidedAt
    },
    scoreAfter: null,
    delta: null
  };
}

function completeSession(
  session: Exclude<TrainingSessionDto, FeedbackReadyTrainingSessionDto>
): CompletedTrainingSessionDto {
  const completedScore =
    session.decision.action === "rejected" ? session.scoreBefore : scoreAfter;

  return {
    ...session,
    status: "completed",
    scoreAfter: completedScore,
    delta: deriveScoreDelta(session.scoreBefore, completedScore)
  };
}

function createFeedbackReadySession(
  sourceMode: "demo" | "live",
  attemptId: unknown = initialAttemptId
): FeedbackReadyTrainingSessionDto {
  return {
    id: sessionId,
    sourceMode,
    feedbackMode: "D",
    practiceDay: 1,
    promptVersion: "analysis-v1|coaching-v1",
    rubricVersion: "stg-rubric-v1",
    modelVersion: "test-model",
    status: "feedback_ready",
    draft: {
      text: draftText,
      attemptId: typeof attemptId === "string" ? attemptId : initialAttemptId,
      submittedAt: "2026-06-25T00:00:00.000Z"
    },
    diagnosis: [
      {
        issue_type: "late_core_message",
        severity: "medium",
        evidence: "Main point appears after background context.",
        why_it_matters: "Interviewers need the main message early.",
        fix_direction: "Lead with the conclusion before details."
      }
    ],
    suggestion: {
      text: suggestionText,
      structureUsed: "Conclusion First",
      whyBetter: [
        {
          changed_what: "Moved the main point earlier.",
          why_changed: "It reduces waiting time for the interviewer.",
          impact: "The answer is easier to evaluate quickly."
        }
      ]
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
}

function apiSuccess(data: Record<string, unknown>, status = 200) {
  return Response.json(
    {
      ok: true,
      data,
      meta: {
        request_id: "fake-request"
      }
    },
    { status }
  );
}

function apiError(
  code: string,
  status: number,
  details: Record<string, unknown> = {}
) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message: code,
        details
      },
      meta: {
        request_id: "fake-request"
      }
    },
    { status }
  );
}

function readBody(body: BodyInit | null | undefined) {
  if (!body || typeof body !== "string") return null;
  return JSON.parse(body) as Record<string, unknown>;
}

const draftText = "我希望通过数据分析帮助团队更清楚地理解业务问题。";
const suggestionText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出更清晰的判断。";
const editedText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出清晰、可靠的业务判断。";

const scoreAfter = {
  total: 82,
  dimensions: []
};
