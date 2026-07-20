import type {
  AiFeedbackInsert,
  AttemptRow,
  ScoreInsert
} from "@/server/attempts/types";

export type MockAttemptResult = {
  score: ScoreInsert;
  feedback: AiFeedbackInsert;
};

export function createDeterministicMockResult(
  attempt: AttemptRow
): MockAttemptResult {
  const score: ScoreInsert = {
    attempt_id: attempt.id,
    answer_relevance: 15,
    core_message: 12,
    structure: 16,
    evidence: 13,
    interview_impact: 12,
    total_score: 68
  };

  assertScoreTotal(score);

  return {
    score,
    feedback: {
      attempt_id: attempt.id,
      diagnosis: [
        {
          issue_type: "late_core_message",
          severity: "medium",
          evidence: "回答先解释背景，核心原因出现较晚。",
          why_it_matters:
            "面试官需要先听较长铺垫，才能知道你的主要答案。",
          fix_direction:
            "第一句话先直接说明你为什么想做数据分析，再补充经历。"
        }
      ],
      rewrite: {
        rewrite_goal: "把核心原因提前，并保留原回答中的真实信息。",
        structure_used: "结论先行 + 补充理由",
        text:
          "我想做数据分析，是因为我喜欢把复杂业务问题转化为可以验证的数据问题。过去的学习和工作经历让我发现，我既喜欢分析过程，也希望让分析结果真正支持业务决策。",
        fact_preservation_note:
          "该版本只调整表达顺序，不新增用户未提供的具体经历、数据或公司信息。"
      },
      why_better: [
        {
          changed_what: "把核心原因放到第一句话。",
          why_changed:
            "原回答如果先讲背景，面试官需要等待较久才能听到答案。",
          impact: "开头更直接，用户的动机更容易被理解。"
        },
        {
          changed_what: "把原因和职业方向连接起来。",
          why_changed: "只说喜欢数据不够具体。",
          impact: "回答更像真实职业选择，而不是兴趣表态。"
        }
      ],
      growth_suggestion: {
        focus_for_next_practice: "结论先行",
        micro_drill:
          "下一次回答时，先只写第一句话，确认它已经直接回答问题。",
        example_sentence_frame: "我想做这份工作，主要因为……",
        estimated_next_level: "Level 1"
      }
    }
  };
}

function assertScoreTotal(score: ScoreInsert) {
  const total =
    score.answer_relevance +
    score.core_message +
    score.structure +
    score.evidence +
    score.interview_impact;

  if (score.total_score !== total) {
    throw new Error("Mock score total must equal the five dimension scores.");
  }
}
