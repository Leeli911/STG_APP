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
import { deriveScoreDelta } from "@/server/training-sessions/trainingSessionDto";
import {
  TrainingSessionGatewayError,
  type CommitTrainingSessionRevisionInput,
  type CreateTrainingSessionGatewayInput,
  type TrainingSessionGateway
} from "@/features/training-session/TrainingSessionGateway";

export type DemoTrainingSessionGatewayOptions = {
  failFirstRescore?: boolean;
  draftText?: string;
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
          "这个幂等键已经用于创建另一条演示训练记录。",
          { status: 409 }
        );
      }

      if (this.createInput.initialAttemptId === input.initialAttemptId) {
        return this.session;
      }
    }

    this.createInput = { ...input };
    const evaluation = this.options.draftText
      ? evaluateDayOneAnswer(this.options.draftText)
      : defaultDemoEvaluation;
    this.session = createFeedbackReadyDemoSession(
      input.initialAttemptId,
      this.options.draftText,
      evaluation
    );
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
        this.session = toCompletedSession(
          this.session,
          this.options.draftText ? undefined : demoScoreAfter
        );
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

    if (validated.value.action === "rejected") {
      this.session = toCompletedSession(this.session);
      return this.session;
    }

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

    this.session = toCompletedSession(
      this.session,
      this.options.draftText ? undefined : demoScoreAfter
    );
    return this.session;
  }

  private requireSession(sessionId: string) {
    if (!this.session || this.session.id !== sessionId) {
      throw new TrainingSessionGatewayError(
        "NOT_FOUND",
        "未找到对应的演示训练记录。",
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
    "这条训练记录已经提交了其他修订决定。",
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
  session: RescoringTrainingSessionDto | RescoreFailedTrainingSessionDto,
  scoreAfterOverride?: ScoreSnapshotDto
): CompletedTrainingSessionDto {
  const scoreAfter =
    session.decision.action === "rejected"
      ? session.scoreBefore
      : scoreAfterOverride ?? evaluateDayOneAnswer(session.final.text).scoreBefore;

  return {
    ...session,
    status: "completed",
    scoreAfter,
    delta: deriveScoreDelta(session.scoreBefore, scoreAfter)
  };
}

function createFeedbackReadyDemoSession(
  initialAttemptId: string,
  draftText = demoDraftText,
  evaluation: DemoEvaluation = defaultDemoEvaluation
): FeedbackReadyTrainingSessionDto {
  return {
    id: demoSessionId,
    sourceMode: "demo",
    feedbackMode: "D",
    practiceDay: 1,
    promptVersion: "demo-analysis-v1|demo-coaching-v1",
    rubricVersion: "stg-rubric-v1",
    modelVersion: "deterministic-demo-v1",
    status: "feedback_ready",
    draft: {
      text: draftText,
      attemptId: initialAttemptId,
      submittedAt: "2026-06-25T00:00:00.000Z"
    },
    diagnosis: evaluation.diagnosis,
    suggestion: evaluation.suggestion,
    scoreBefore: evaluation.scoreBefore,
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
      displayName: "核心信息",
      score: 12,
      maxScore: 20,
      evidence: "核心观点出现在背景说明之后。",
      deductions: [
        {
          rule: "conclusion_first",
          points: 4,
          reason: "面试官需要先听完背景，才能知道回答的核心观点。"
        }
      ],
      improvementFocus: "先说结论，再补充细节。"
    }
  ]
};

const demoScoreAfter: ScoreSnapshotDto = {
  total: 82,
  dimensions: [
    {
      dimension: "core_message",
      displayName: "核心信息",
      score: 17,
      maxScore: 20,
      evidence: "修订后的回答更早说明了希望带来的价值。",
      deductions: [
        {
          rule: "specificity",
          points: 1,
          reason: "回答还可以加入一个更具体的例子。"
        }
      ],
      improvementFocus: "补充一个可衡量的例子来支撑核心观点。"
    }
  ]
};

type DemoEvaluation = Pick<
  FeedbackReadyTrainingSessionDto,
  "diagnosis" | "suggestion" | "scoreBefore"
>;

const defaultDemoEvaluation: DemoEvaluation = {
  diagnosis: [
    {
      issue_type: "late_core_message",
      severity: "medium",
      evidence: "核心观点出现在背景说明之后。",
      why_it_matters: "面试官需要尽早听到回答的核心观点。",
      fix_direction: "先说结论，再补充细节。"
    }
  ],
  suggestion: {
    text: demoSuggestionText,
    structureUsed: "结论先行",
    whyBetter: [
      {
        changed_what: "把核心观点提前到了第一句话。",
        why_changed: "减少面试官等待关键信息的时间。",
        impact: "回答更直接，也更容易被快速理解和判断。"
      }
    ]
  },
  scoreBefore: demoScoreBefore
};

function evaluateDayOneAnswer(answer: string): DemoEvaluation {
  const sentences = splitSentences(answer);
  const coreIndex = sentences.findIndex(isCoreMessage);
  const suggestionText = buildConclusionFirstSuggestion(sentences, coreIndex);

  if (coreIndex === 0) {
    const hasSupport = sentences.length > 1;
    return {
      diagnosis: [
        {
          issue_type: hasSupport ? "other" : "lack_example",
          severity: "low",
          evidence: `第一句话已经直接说明核心价值：“${sentences[0]}”`,
          why_it_matters: "结论先行能让面试官立即知道你想表达什么。",
          fix_direction: hasSupport
            ? "保留当前顺序，并检查后续内容是否都在支撑第一句话。"
            : "保留第一句结论，再补充一个具体业务场景或行动。"
        }
      ],
      suggestion: {
        text: suggestionText,
        structureUsed: "结论先行",
        whyBetter: [
          {
            changed_what: hasSupport
              ? "保留第一句结论，并明确后续内容的支撑关系。"
              : "保留已经清楚的第一句结论。",
            why_changed: "原回答已经满足结论先行，不需要为了改写而改写。",
            impact: hasSupport
              ? "面试官可以先理解结论，再顺着依据继续判断。"
              : "当前版本易于理解；下一步应补充证据，而不是改动顺序。"
          }
        ]
      },
      scoreBefore: createRuleScore(hasSupport ? 17 : 15, hasSupport)
    };
  }

  if (coreIndex > 0) {
    return {
      diagnosis: [
        {
          issue_type: "late_core_message",
          severity: "medium",
          evidence: `核心价值到第 ${coreIndex + 1} 句才出现：“${sentences[coreIndex]}”`,
          why_it_matters: "面试官需要先听铺垫，才能知道回答的核心观点。",
          fix_direction: "把这句核心价值移到开头，再补充背景。"
        }
      ],
      suggestion: {
        text: suggestionText,
        structureUsed: "结论先行",
        whyBetter: [
          {
            changed_what: `把第 ${coreIndex + 1} 句的核心价值移到了开头。`,
            why_changed: "先回答问题，再解释背景，能减少理解等待。",
            impact: "面试官可以先判断你的价值主张，再理解支撑信息。"
          }
        ]
      },
      scoreBefore: createRuleScore(12, true)
    };
  }

  return {
    diagnosis: [
      {
        issue_type: "missing_core_message",
        severity: "high",
        evidence: `当前回答没有明确出现“我希望为团队带来什么价值”的结论：“${sentences[0]}”`,
        why_it_matters: "面试官听完后仍可能不知道你能为团队解决什么问题。",
        fix_direction: "先用一句话直接说明你希望通过数据分析带来的团队价值。"
      }
    ],
    suggestion: {
      text: suggestionText,
      structureUsed: "结论先行",
      whyBetter: [
        {
          changed_what: "增加了一句直接回答题目的价值结论。",
          why_changed: "原回答没有明确回答希望为团队带来什么价值。",
          impact: "面试官能够先听到答案，再判断原有内容是否构成支撑。"
        }
      ]
    },
    scoreBefore: createRuleScore(8, sentences.length > 1)
  };
}

function createRuleScore(
  coreScore: number,
  hasSupportingSentence: boolean
): ScoreSnapshotDto {
  const isConclusionFirst = coreScore >= 15;
  return {
    total: coreScore * 5,
    dimensions: [
      {
        dimension: "core_message",
        displayName: "核心信息",
        score: coreScore,
        maxScore: 20,
        evidence: isConclusionFirst
          ? "核心价值出现在第一句话。"
          : coreScore === 12
            ? "核心价值出现在背景说明之后。"
            : "尚未识别到直接回答题目的价值结论。",
        deductions: isConclusionFirst
          ? hasSupportingSentence
            ? [
                {
                  rule: "specificity",
                  points: 1,
                  reason: "还可以补充更具体的行动或结果。"
                }
              ]
            : [
                {
                  rule: "supporting_evidence",
                  points: 3,
                  reason: "第一句结论之后还缺少具体支撑。"
                }
              ]
          : [
              {
                rule: "conclusion_first",
                points: coreScore === 12 ? 4 : 8,
                reason:
                  coreScore === 12
                    ? "面试官需要先听铺垫，才能听到核心价值。"
                    : "回答没有直接说明希望为团队带来的价值。"
              }
            ],
        improvementFocus: isConclusionFirst
          ? "保留结论先行，并补充具体支撑。"
          : "第一句话直接说明希望为团队带来的价值。"
      }
    ]
  };
}

function splitSentences(answer: string) {
  const sentences = answer
    .trim()
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.length > 0 ? sentences : [answer.trim()];
}

function isCoreMessage(sentence: string) {
  return /(?:我希望|我能|我会|我可以|我能够|我的价值|通过数据分析|数据分析(?:可以|能够|能|会)|帮助团队|支持团队|为团队)/.test(
    sentence
  );
}

function buildConclusionFirstSuggestion(
  sentences: string[],
  coreIndex: number
) {
  if (coreIndex > 0) {
    return [
      sentences[coreIndex],
      ...sentences.filter((_, index) => index !== coreIndex)
    ].join("");
  }
  if (coreIndex === 0) return sentences.join("");
  return `我希望通过数据分析帮助团队做出更有依据的判断。${sentences.join("")}`;
}
