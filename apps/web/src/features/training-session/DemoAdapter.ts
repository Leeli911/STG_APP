import { validateRevisionDecision } from "@/lib/validation/revision";
import type {
  CompletedTrainingSessionDto,
  FeedbackReadyTrainingSessionDto,
  RescoreFailedTrainingSessionDto,
  RescoringTrainingSessionDto,
  ScoreSnapshotDto,
  TrainingSessionDecisionDto,
  TrainingSessionDto
} from "@/server/training-sessions/types";
import {
  TrainingSessionGatewayError,
  type CommitTrainingSessionRevisionInput,
  type CreateTrainingSessionGatewayInput,
  type TrainingSessionGateway
} from "@/features/training-session/TrainingSessionGateway";

export type DemoTrainingSessionGatewayOptions = {
  failFirstRescore?: boolean;
};

export function createDemoTrainingSessionGateway(
  options: DemoTrainingSessionGatewayOptions = {}
): TrainingSessionGateway {
  return new DemoTrainingSessionGateway(options);
}

class DemoTrainingSessionGateway implements TrainingSessionGateway {
  private session: TrainingSessionDto | null = null;
  private createInput: CreateTrainingSessionGatewayInput | null = null;
  private failedOnce = false;

  constructor(private readonly options: DemoTrainingSessionGatewayOptions) {}

  async createSession(input: CreateTrainingSessionGatewayInput) {
    if (this.session && this.createInput) {
      if (
        this.createInput.idempotencyKey === input.idempotencyKey &&
        this.createInput.initialAttemptId !== input.initialAttemptId
      ) {
        throw new TrainingSessionGatewayError(
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key already created a different demo session.",
          { status: 409 }
        );
      }

      if (this.createInput.initialAttemptId === input.initialAttemptId) {
        return this.session;
      }
    }

    this.createInput = { ...input };
    this.session = createFeedbackReadyDemoSession(input.initialAttemptId);
    return this.session;
  }

  async getSession(sessionId: string) {
    return this.requireSession(sessionId);
  }

  async commitRevision(input: CommitTrainingSessionRevisionInput) {
    const current = this.requireSession(input.sessionId);

    if (current.decision) {
      if (!isSameDecision(current.decision, input, current)) {
        throw revisionConflict(current.id);
      }

      if (current.status === "rescore_failed") {
        this.session = toRescoringSession(current);
        await Promise.resolve();
        this.session = toCompletedSession(this.session);
      }

      return this.session ?? current;
    }

    const validated = validateRevisionDecision({
      action: input.action,
      editedText: input.editedText,
      draftText: current.draft.text,
      suggestionText: current.suggestion.text
    });

    if (!validated.ok) {
      throw new TrainingSessionGatewayError(
        "VALIDATION_ERROR",
        validated.message,
        {
          status: 400,
          details: {
            field: validated.field
          }
        }
      );
    }

    this.session = {
      ...current,
      status: "rescoring",
      decision: {
        action: validated.value.action,
        editedText: validated.value.editedText,
        decidedAt: input.clientDecidedAt,
        idempotencyKey: input.idempotencyKey
      },
      final: {
        text: validated.value.finalText,
        attemptId: demoFinalAttemptId,
        submittedAt: input.clientDecidedAt
      },
      scoreAfter: null,
      delta: null
    };
    await Promise.resolve();

    if (this.options.failFirstRescore && !this.failedOnce) {
      this.failedOnce = true;
      this.session = {
        ...this.session,
        status: "rescore_failed",
        scoreAfter: null,
        delta: null
      };
      return this.session;
    }

    this.session = toCompletedSession(this.session);
    return this.session;
  }

  private requireSession(sessionId: string) {
    if (!this.session || this.session.id !== sessionId) {
      throw new TrainingSessionGatewayError(
        "NOT_FOUND",
        "Demo training session was not found.",
        {
          status: 404,
          details: {
            session_id: sessionId
          }
        }
      );
    }

    return this.session;
  }
}

function isSameDecision(
  decision: TrainingSessionDecisionDto,
  input: CommitTrainingSessionRevisionInput,
  session: TrainingSessionDto
) {
  const validated = validateRevisionDecision({
    action: input.action,
    editedText: input.editedText,
    draftText: session.draft.text,
    suggestionText: session.suggestion.text
  });

  return (
    validated.ok &&
    decision.idempotencyKey === input.idempotencyKey &&
    decision.action === validated.value.action &&
    decision.editedText === validated.value.editedText
  );
}

function revisionConflict(sessionId: string) {
  return new TrainingSessionGatewayError(
    "REVISION_ALREADY_COMMITTED",
    "A different revision decision is already committed.",
    {
      status: 409,
      details: {
        session_id: sessionId
      }
    }
  );
}

function toRescoringSession(
  session: RescoreFailedTrainingSessionDto
): RescoringTrainingSessionDto {
  return {
    ...session,
    status: "rescoring",
    scoreAfter: null,
    delta: null
  };
}

function toCompletedSession(
  session: RescoringTrainingSessionDto | RescoreFailedTrainingSessionDto
): CompletedTrainingSessionDto {
  return {
    ...session,
    status: "completed",
    scoreAfter: demoScoreAfter,
    delta: null
  };
}

function createFeedbackReadyDemoSession(
  initialAttemptId: string
): FeedbackReadyTrainingSessionDto {
  return {
    id: demoSessionId,
    sourceMode: "demo",
    feedbackMode: "D",
    practiceDay: 1,
    status: "feedback_ready",
    draft: {
      text: demoDraftText,
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
      text: demoSuggestionText,
      structureUsed: "Conclusion First",
      whyBetter: [
        {
          changed_what: "Moved the main point earlier.",
          why_changed: "It reduces waiting time for the interviewer.",
          impact: "The answer is easier to evaluate quickly."
        }
      ]
    },
    scoreBefore: demoScoreBefore,
    decision: null,
    final: null,
    scoreAfter: null,
    delta: null,
    feedbackShownAt: "2026-06-25T00:01:00.000Z"
  };
}

const demoSessionId = "00000000-0000-4000-8000-000000000201";
const demoFinalAttemptId = "00000000-0000-4000-8000-000000000102";
const demoDraftText = "我希望通过数据分析帮助团队更清楚地理解业务问题。";
const demoSuggestionText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出更清晰的判断。";

const demoScoreBefore: ScoreSnapshotDto = {
  total: 68,
  dimensions: [
    {
      dimension: "core_message",
      displayName: "Core Message",
      score: 12,
      maxScore: 20,
      evidence: "Main point appears after background context.",
      deductions: [
        {
          rule: "conclusion_first",
          points: 4,
          reason: "The interviewer must wait before hearing the main message."
        }
      ],
      improvementFocus: "Lead with the conclusion before details."
    }
  ]
};

const demoScoreAfter: ScoreSnapshotDto = {
  total: 82,
  dimensions: [
    {
      dimension: "core_message",
      displayName: "Core Message",
      score: 17,
      maxScore: 20,
      evidence: "The revised answer states the communication goal earlier.",
      deductions: [
        {
          rule: "specificity",
          points: 1,
          reason: "The answer could still include a more concrete example."
        }
      ],
      improvementFocus: "Add one measurable example to support the message."
    }
  ]
};
