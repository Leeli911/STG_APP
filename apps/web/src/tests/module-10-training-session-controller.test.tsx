import { act, render, screen, waitFor } from "@testing-library/react";

import {
  TrainingSessionController,
  type TrainingSessionControllerViewModel
} from "@/features/training-session/TrainingSessionController";
import {
  TrainingSessionGatewayError,
  type TrainingSessionGateway
} from "@/features/training-session/TrainingSessionGateway";
import type {
  CompletedTrainingSessionDto,
  FeedbackReadyTrainingSessionDto,
  RescoreFailedTrainingSessionDto,
  RescoringTrainingSessionDto,
  TrainingSessionDto
} from "@/server/training-sessions/types";

const initialAttemptId = "00000000-0000-4000-8000-000000000101";
const sessionId = "00000000-0000-4000-8000-000000000201";
const finalAttemptId = "00000000-0000-4000-8000-000000000102";
const decidedAt = "2026-06-25T00:03:00.000Z";
const draftText = "我希望通过数据分析帮助团队更清楚地理解业务问题。";
const suggestionText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出更清晰的判断。";
const editedText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出清晰、可靠的业务判断。";

describe("Module 10 TrainingSessionController", () => {
  it("runs the create flow through Gateway createSession then getSession", async () => {
    const created = feedbackReadySession();
    const hydrated = {
      ...created,
      feedbackShownAt: "2026-06-25T00:02:00.000Z"
    };
    const gateway = createGateway({
      createSession: vi.fn().mockResolvedValue(created),
      getSession: vi.fn().mockResolvedValue(hydrated)
    });

    const { viewModel, makeCreateKey } = renderController({ gateway });

    await waitFor(() => {
      expect(viewModel().session).toEqual(hydrated);
      expect(viewModel().isLoading).toBe(false);
    });
    expect(gateway.createSession).toHaveBeenCalledWith({
      initialAttemptId,
      idempotencyKey: "create-key"
    });
    expect(gateway.getSession).toHaveBeenCalledWith(sessionId);
    expect(
      gateway.createSession.mock.invocationCallOrder[0]
    ).toBeLessThan(gateway.getSession.mock.invocationCallOrder[0]);
    expect(makeCreateKey).toHaveBeenCalledTimes(1);
  });

  it("commits an accepted decision with one revision key and updates the DTO", async () => {
    const pending = deferred<TrainingSessionDto>();
    const gateway = createGateway({
      commitRevision: vi.fn().mockReturnValue(pending.promise)
    });
    const { viewModel, makeRevisionKey } = renderController({
      gateway,
      initialSession: feedbackReadySession()
    });

    act(() => {
      viewModel().selectAction("accepted");
    });
    let submit: Promise<void>;
    act(() => {
      submit = viewModel().submitRevision();
    });

    await waitFor(() => {
      expect(viewModel().isSubmitting).toBe(true);
      expect(viewModel().controlsDisabled).toBe(true);
    });
    pending.resolve(completedSession());
    await act(async () => {
      await submit!;
    });

    expect(gateway.commitRevision).toHaveBeenCalledWith({
      sessionId,
      idempotencyKey: "revision-key",
      action: "accepted",
      editedText: null,
      clientDecidedAt: decidedAt
    });
    expect(makeRevisionKey).toHaveBeenCalledTimes(1);
    expect(viewModel().session).toMatchObject({
      status: "completed",
      decision: {
        idempotencyKey: "revision-key",
        action: "accepted"
      },
      final: {
        text: suggestionText
      }
    });
    expect(viewModel().isSubmitting).toBe(false);
    expect(viewModel().networkError).toBeNull();
  });

  it("validates Edit in the controller before any Gateway call", async () => {
    const gateway = createGateway();
    const { viewModel, makeRevisionKey } = renderController({
      gateway,
      initialSession: feedbackReadySession()
    });

    act(() => {
      viewModel().selectAction("edited");
      viewModel().setEditText(` ${suggestionText} `);
    });
    await act(async () => {
      await viewModel().submitRevision();
    });

    expect(viewModel().validationError).toBe(
      "edited_text must differ from the suggestion."
    );
    expect(gateway.commitRevision).not.toHaveBeenCalled();
    expect(makeRevisionKey).not.toHaveBeenCalled();
  });

  it("normalizes edited text and sends it through the same revision flow", async () => {
    const gateway = createGateway({
      commitRevision: vi.fn().mockResolvedValue(
        completedSession({
          action: "edited",
          editedText,
          finalText: editedText
        })
      )
    });
    const { viewModel } = renderController({
      gateway,
      initialSession: feedbackReadySession()
    });

    act(() => {
      viewModel().selectAction("edited");
      viewModel().setEditText(` ${editedText} `);
    });
    await act(async () => {
      await viewModel().submitRevision();
    });

    expect(gateway.commitRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "edited",
        editedText,
        idempotencyKey: "revision-key"
      })
    );
    expect(viewModel().validationError).toBeNull();
    expect(viewModel().session?.status).toBe("completed");
  });

  it("retries a rescore_failed session with the DTO decision key instead of generating a new key", async () => {
    const failed = rescoreFailedSession({
      action: "edited",
      editedText,
      finalText: editedText,
      idempotencyKey: "existing-revision-key"
    });
    const completed = completedSession({
      action: "edited",
      editedText,
      finalText: editedText,
      idempotencyKey: "existing-revision-key"
    });
    const gateway = createGateway({
      commitRevision: vi.fn().mockResolvedValue(completed)
    });
    const { viewModel, makeRevisionKey } = renderController({
      gateway,
      initialSession: failed
    });

    await act(async () => {
      await viewModel().retryRevision();
    });

    expect(gateway.commitRevision).toHaveBeenCalledWith({
      sessionId,
      idempotencyKey: "existing-revision-key",
      action: "edited",
      editedText,
      clientDecidedAt: decidedAt
    });
    expect(makeRevisionKey).not.toHaveBeenCalled();
    expect(viewModel().session).toEqual(completed);
    expect(viewModel().retrying).toBe(false);
  });

  it("uses the same revision key when retrying after a controller-held rescore_failed DTO update", async () => {
    const failed = rescoreFailedSession();
    const completed = completedSession();
    const gateway = createGateway({
      commitRevision: vi.fn()
        .mockResolvedValueOnce(failed)
        .mockResolvedValueOnce(completed)
    });
    const { viewModel, makeRevisionKey } = renderController({
      gateway,
      initialSession: feedbackReadySession()
    });

    act(() => {
      viewModel().selectAction("accepted");
    });
    await act(async () => {
      await viewModel().submitRevision();
    });
    await act(async () => {
      await viewModel().retryRevision();
    });

    expect(makeRevisionKey).toHaveBeenCalledTimes(1);
    expect(gateway.commitRevision).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        idempotencyKey: "revision-key",
        action: "accepted",
        editedText: null,
        clientDecidedAt: decidedAt
      })
    );
    expect(viewModel().session).toEqual(completed);
  });

  it("recovers network-uncertain commits by reading the current session before any retry", async () => {
    const recovered = rescoringSession();
    const gateway = createGateway({
      commitRevision: vi.fn().mockRejectedValue(
        new TrainingSessionGatewayError(
          "NETWORK_UNCERTAIN",
          "Revision outcome is unknown after a network error.",
          { status: 0 }
        )
      ),
      getSession: vi.fn().mockResolvedValue(recovered)
    });
    const { viewModel } = renderController({
      gateway,
      initialSession: feedbackReadySession()
    });

    act(() => {
      viewModel().selectAction("accepted");
    });
    await act(async () => {
      await viewModel().submitRevision();
    });

    expect(gateway.commitRevision).toHaveBeenCalledTimes(1);
    expect(gateway.getSession).toHaveBeenCalledWith(sessionId);
    expect(
      gateway.commitRevision.mock.invocationCallOrder[0]
    ).toBeLessThan(gateway.getSession.mock.invocationCallOrder[0]);
    expect(viewModel().session).toEqual(recovered);
    expect(viewModel().networkError).toBeNull();
  });

  it("surfaces a network message when recovery still shows feedback_ready", async () => {
    const gateway = createGateway({
      commitRevision: vi.fn().mockRejectedValue(
        new TrainingSessionGatewayError(
          "NETWORK_UNCERTAIN",
          "Revision outcome is unknown after a network error.",
          { status: 0 }
        )
      ),
      getSession: vi.fn().mockResolvedValue(feedbackReadySession())
    });
    const { viewModel } = renderController({
      gateway,
      initialSession: feedbackReadySession()
    });

    act(() => {
      viewModel().selectAction("accepted");
    });
    await act(async () => {
      await viewModel().submitRevision();
    });

    expect(viewModel().session?.status).toBe("feedback_ready");
    expect(viewModel().networkError).toBe(
      "暂时无法确认修订是否已保存，请重试。"
    );
  });
});

type MockGateway = {
  [Key in keyof TrainingSessionGateway]: ReturnType<typeof vi.fn>;
};

function renderController({
  gateway = createGateway(),
  initialSession = null
}: {
  gateway?: MockGateway;
  initialSession?: TrainingSessionDto | null;
} = {}) {
  let latest: TrainingSessionControllerViewModel | null = null;
  const makeCreateKey = vi.fn(() => "create-key");
  const makeRevisionKey = vi.fn(() => "revision-key");

  render(
    <TrainingSessionController
      gateway={gateway}
      initialAttemptId={initialAttemptId}
      initialSession={initialSession}
      makeCreateSessionIdempotencyKey={makeCreateKey}
      makeRevisionIdempotencyKey={makeRevisionKey}
      currentTime={() => decidedAt}
    >
      {(viewModel) => {
        latest = viewModel;
        return (
          <output data-testid="controller-state">
            {viewModel.session?.status ?? "loading"}
          </output>
        );
      }}
    </TrainingSessionController>
  );

  expect(screen.getByTestId("controller-state")).toBeInTheDocument();

  return {
    gateway,
    makeCreateKey,
    makeRevisionKey,
    viewModel: () => {
      if (!latest) throw new Error("Controller did not render.");
      return latest;
    }
  };
}

function createGateway(
  overrides: Partial<MockGateway> = {}
): MockGateway {
  return {
    createSession: vi.fn().mockResolvedValue(feedbackReadySession()),
    getSession: vi.fn().mockResolvedValue(feedbackReadySession()),
    commitRevision: vi.fn().mockResolvedValue(completedSession()),
    ...overrides
  };
}

function feedbackReadySession(): FeedbackReadyTrainingSessionDto {
  return {
    id: sessionId,
    sourceMode: "demo",
    feedbackMode: "D",
    practiceDay: 1,
    promptVersion: "analysis-v1|coaching-v1",
    rubricVersion: "stg-rubric-v1",
    modelVersion: "test-model",
    status: "feedback_ready",
    draft: {
      text: draftText,
      attemptId: initialAttemptId,
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
}

function rescoringSession(
  options: RevisionFixtureOptions = {}
): RescoringTrainingSessionDto {
  return {
    ...feedbackReadySession(),
    status: "rescoring",
    decision: decision(options),
    final: finalAnswer(options),
    scoreAfter: null,
    delta: null
  };
}

function rescoreFailedSession(
  options: RevisionFixtureOptions = {}
): RescoreFailedTrainingSessionDto {
  return {
    ...feedbackReadySession(),
    status: "rescore_failed",
    decision: decision(options),
    final: finalAnswer(options),
    scoreAfter: null,
    delta: null
  };
}

function completedSession(
  options: RevisionFixtureOptions = {}
): CompletedTrainingSessionDto {
  return {
    ...feedbackReadySession(),
    status: "completed",
    decision: decision(options),
    final: finalAnswer(options),
    scoreAfter: {
      total: 82,
      dimensions: []
    },
    delta: null
  };
}

type RevisionFixtureOptions = {
  action?: "accepted" | "rejected" | "edited";
  editedText?: string | null;
  finalText?: string;
  idempotencyKey?: string;
};

function decision({
  action = "accepted",
  editedText = null,
  idempotencyKey = "revision-key"
}: RevisionFixtureOptions = {}) {
  return {
    action,
    editedText,
    decidedAt,
    idempotencyKey
  };
}

function finalAnswer({
  action = "accepted",
  finalText
}: RevisionFixtureOptions = {}) {
  return {
    text:
      finalText ??
      (action === "accepted"
        ? suggestionText
        : action === "rejected"
          ? draftText
          : editedText),
    attemptId: finalAttemptId,
    submittedAt: decidedAt
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}
