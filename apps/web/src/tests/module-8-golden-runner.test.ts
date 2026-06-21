import { loadGoldenSetV1, runGoldenCaseChecks } from "@/server/benchmarks/goldenSet";
import { AnalysisOutputSchema } from "@/schemas/ai";

const validAnalysis = AnalysisOutputSchema.parse({
  question_analysis: {
    question_type: "project_experience",
    expected_structure: "Conclusion + STAR",
    requires_example: true,
    requires_metric: true,
    requires_role_fit: true
  },
  observable_features: {
    answer_length_chars: 28,
    main_point_position: {
      status: "missing",
      char_index: 0,
      evidence: "没有明确结论。"
    },
    has_clear_opening_claim: false,
    has_structure_markers: false,
    has_specific_example: false,
    has_personal_action: false,
    has_result: false,
    has_metric: false,
    has_role_fit: false,
    repetition_level: "low",
    off_topic_level: "none",
    star_completeness: {
      situation: false,
      task: false,
      action: false,
      result: false
    }
  },
  score: {
    total: 32,
    score_band: "poor",
    learning_level: "Level 1"
  },
  dimension_scores: [
    {
      dimension: "relevance",
      score: 8,
      max_score: 20,
      evidence: "回答相关但信息不足。",
      deductions: []
    },
    {
      dimension: "core_message",
      score: 5,
      max_score: 20,
      evidence: "缺少核心结论。",
      deductions: []
    },
    {
      dimension: "structure",
      score: 7,
      max_score: 25,
      evidence: "没有 STAR 结构。",
      deductions: []
    },
    {
      dimension: "evidence",
      score: 6,
      max_score: 20,
      evidence: "缺少具体项目。",
      deductions: []
    },
    {
      dimension: "interview_impact",
      score: 6,
      max_score: 15,
      evidence: "无法证明能力。",
      deductions: []
    }
  ],
  diagnosis: [
    {
      issue_id: "D001",
      issue_type: "lack_example",
      severity: "high",
      location: "whole_answer",
      evidence: "没有具体项目。",
      why_it_matters: "回答无法证明能力。"
    }
  ],
  quality_flags: []
});

describe("Module 8 Golden Set runner foundation", () => {
  it("loads the fixed 20-case Golden Set V1", () => {
    const goldenSet = loadGoldenSetV1();

    expect(goldenSet.version).toBe("Golden Set V1");
    expect(goldenSet.cases).toHaveLength(20);
    expect(goldenSet.cases[0]).toMatchObject({
      id: "case-01",
      expected_score_range: {
        min: 25,
        max: 40
      }
    });
  });

  it("checks JSON validity, total score, score range, and banned phrases", () => {
    const [case01] = loadGoldenSetV1().cases;
    const result = runGoldenCaseChecks({
      goldenCase: case01,
      analysis: validAnalysis,
      coachingText: "改写里没有禁用短语。"
    });

    expect(result).toMatchObject({
      valid_json: true,
      total_score_valid: true,
      expected_score_range_hit: true,
      banned_phrase_count: 0
    });
  });
});
