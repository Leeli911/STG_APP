import { render, screen } from "@testing-library/react";

import { ExplainableRubric } from "@/components/training/ExplainableRubric";
import { TrainingSessionScreen } from "@/features/training-session/TrainingSessionScreen";
import { toFeedbackReadyTrainingSessionDto } from "@/server/training-sessions";
import type {
  AiFeedbackRow,
  AttemptRow,
  ScoreRow
} from "@/server/attempts";

const attempt: AttemptRow = {
  id: "attempt-1",
  user_id: "user-1",
  question_id: "00000000-0000-4000-8000-000000000001",
  day_number: 1,
  original_answer:
    "我想做数据分析，因为我喜欢把复杂问题讲清楚并支持业务判断。",
  status: "completed",
  idempotency_key: "attempt-key-1",
  client_started_at: null,
  created_at: "2026-06-23T01:00:00.000Z"
};

const score: ScoreRow = {
  attempt_id: attempt.id,
  answer_relevance: 15,
  core_message: 12,
  structure: 16,
  evidence: 13,
  interview_impact: 12,
  total_score: 68,
  rubric_evidence: {
    dimension_scores: [
      {
        dimension: "relevance",
        score: 15,
        max_score: 20,
        evidence: "回答与题目相关。",
        deductions: []
      },
      {
        dimension: "core_message",
        score: 12,
        max_score: 20,
        evidence: "核心原因出现较早，但还可以更具体。",
        deductions: []
      },
      {
        dimension: "structure",
        score: 16,
        max_score: 25,
        evidence: "回答有基本因果结构。",
        deductions: []
      },
      {
        dimension: "evidence",
        score: 13,
        max_score: 20,
        evidence: "有原因但缺少具体经历。",
        deductions: [
          {
            rule: "specific_example",
            points: 2,
            reason: "缺少真实经历。"
          }
        ]
      },
      {
        dimension: "interview_impact",
        score: 12,
        max_score: 15,
        evidence: "表达可以理解，但说服力有限。",
        deductions: []
      }
    ]
  },
  created_at: "2026-06-23T01:00:01.000Z"
};

const feedback: AiFeedbackRow = {
  attempt_id: attempt.id,
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
      "我想做数据分析，是因为我喜欢把复杂问题讲清楚，并用分析结果支持业务判断。",
    fact_preservation_note: "没有新增用户未提供的经历、数据或公司。"
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
  created_at: "2026-06-23T01:00:02.000Z"
};

describe("Module 9 explainable feedback mapper", () => {
  it("maps existing rubric evidence into explainable dimensions", () => {
    const session = toFeedbackReadyTrainingSessionDto({
      sessionId: "session-1",
      sourceMode: "live",
      feedbackMode: "D",
      attempt,
      score,
      feedback
    });

    expect(session.status).toBe("feedback_ready");
    expect(session.scoreBefore.dimensions).toContainEqual({
      dimension: "evidence",
      displayName: "Evidence",
      score: 13,
      maxScore: 20,
      evidence: "有原因但缺少具体经历。",
      deductions: [
        {
          rule: "specific_example",
          points: 2,
          reason: "缺少真实经历。"
        }
      ],
      improvementFocus: "补充一个真实学习或工作场景。"
    });
    expect(session).toMatchObject({
      id: "session-1",
      sourceMode: "live",
      feedbackMode: "D",
      practiceDay: 1,
      feedbackShownAt: null,
      decision: null,
      final: null,
      scoreAfter: null,
      delta: null
    });
  });

  it("uses null when no diagnosis maps to a dimension", () => {
    const session = toFeedbackReadyTrainingSessionDto({
      sessionId: "session-1",
      sourceMode: "demo",
      feedbackMode: "D",
      attempt,
      score,
      feedback: {
        ...feedback,
        diagnosis: []
      }
    });

    expect(
      session.scoreBefore.dimensions.find(
        (item) => item.dimension === "evidence"
      )?.improvementFocus
    ).toBeNull();
  });

  it("does not invent dimension evidence for historical rows without rubric data", () => {
    const session = toFeedbackReadyTrainingSessionDto({
      sessionId: "session-1",
      sourceMode: "live",
      feedbackMode: "D",
      attempt,
      score: {
        ...score,
        rubric_evidence: null
      },
      feedback
    });

    expect(session.scoreBefore.dimensions).toEqual([]);
  });
});

describe("Module 9 ExplainableRubric", () => {
  it("renders score, evidence, deduction, and improvement focus", () => {
    const session = createSession();

    render(
      <ExplainableRubric dimensions={session.scoreBefore.dimensions} />
    );

    expect(
      screen.getByRole("heading", { name: "Evidence" })
    ).toBeInTheDocument();
    expect(screen.getByText("13 / 20")).toBeInTheDocument();
    expect(screen.getByText("有原因但缺少具体经历。")).toBeInTheDocument();
    expect(screen.getByText("缺少真实经历。")).toBeInTheDocument();
    expect(
      screen.getByText("补充一个真实学习或工作场景。")
    ).toBeInTheDocument();
  });

  it("renders neutral empty states without generating coaching content", () => {
    const session = createSession({
      ...feedback,
      diagnosis: []
    });
    const relevance = session.scoreBefore.dimensions.find(
      (item) => item.dimension === "relevance"
    );

    if (!relevance) {
      throw new Error("Relevance dimension fixture is missing.");
    }

    render(<ExplainableRubric dimensions={[relevance]} />);

    expect(screen.getByText("No deductions recorded.")).toBeInTheDocument();
    expect(
      screen.getByText("No primary improvement focus.")
    ).toBeInTheDocument();
  });

  it("explains when historical rubric details are unavailable", () => {
    render(<ExplainableRubric dimensions={[]} />);

    expect(
      screen.getByText("Detailed rubric is unavailable for this earlier attempt.")
    ).toBeInTheDocument();
  });
});

describe("Module 9 TrainingSessionScreen", () => {
  it("renders total score and explainable rubric in feedback_ready", () => {
    render(<TrainingSessionScreen session={createSession()} />);

    expect(screen.getByText("68")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Score Breakdown" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Core Message" })
    ).toBeInTheDocument();
  });
});

function createSession(feedbackRow: AiFeedbackRow = feedback) {
  return toFeedbackReadyTrainingSessionDto({
    sessionId: "session-1",
    sourceMode: "live",
    feedbackMode: "D",
    attempt,
    score,
    feedback: feedbackRow
  });
}
