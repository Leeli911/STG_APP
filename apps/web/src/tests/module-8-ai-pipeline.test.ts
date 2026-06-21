import { z } from "zod";

import { getAiRuntimeConfig } from "@/server/ai/config";
import { runAiCoachPipeline } from "@/server/ai/pipeline";
import type { StgAiClient } from "@/server/ai/types";
import {
  AnalysisOutputSchema,
  CoachingOutputSchema,
  validateCoachingMatchesAnalysis
} from "@/schemas/ai";
import { createPromptResolver } from "@/server/prompts/promptResolver";
import type {
  AiFeedbackInsert,
  AiFeedbackRow,
  AttemptQuestionRow,
  AttemptRepository,
  AttemptRow,
  AttemptStatus,
  ScoreInsert,
  ScoreRow
} from "@/server/attempts";

const question: AttemptQuestionRow = {
  id: "00000000-0000-4000-8000-000000000001",
  day_number: 1,
  is_active: true,
  title: "Conclusion First",
  scenario: "面试官问你一个非常简单的问题，希望快速了解你。",
  prompt: "你为什么想做数据分析这份工作？",
  expected_structure: "第一句话直接回答原因。后面再补充经历或背景。",
  learning_goal: "只训练结论先行。",
  evaluation_focus: "核心答案是否出现在第一句话。"
};

const attempt: AttemptRow = {
  id: "attempt-1",
  user_id: "user-1",
  question_id: question.id,
  day_number: 1,
  original_answer: "我想做数据分析，因为我喜欢把复杂问题讲清楚并支持业务判断。",
  status: "submitted",
  idempotency_key: "idem-1",
  client_started_at: null,
  created_at: "2026-06-19T00:00:00.000Z"
};

const validAnalysis = {
  question_analysis: {
    question_type: "motivation",
    expected_structure: "先说明动机，再补充原因。",
    requires_example: false,
    requires_metric: false,
    requires_role_fit: true
  },
  observable_features: {
    answer_length_chars: 31,
    main_point_position: {
      status: "first_sentence",
      char_index: 0,
      evidence: "开头直接说明想做数据分析。"
    },
    has_clear_opening_claim: true,
    has_structure_markers: false,
    has_specific_example: false,
    has_personal_action: false,
    has_result: false,
    has_metric: false,
    has_role_fit: true,
    repetition_level: "none",
    off_topic_level: "none",
    star_completeness: {
      situation: false,
      task: false,
      action: false,
      result: false
    }
  },
  score: {
    total: 68,
    score_band: "basic",
    learning_level: "Level 1"
  },
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
      evidence: "有基本因果结构。",
      deductions: []
    },
    {
      dimension: "evidence",
      score: 13,
      max_score: 20,
      evidence: "有原因但缺少具体经历。",
      deductions: []
    },
    {
      dimension: "interview_impact",
      score: 12,
      max_score: 15,
      evidence: "表达可理解。",
      deductions: []
    }
  ],
  diagnosis: [
    {
      issue_id: "D001",
      issue_type: "lack_example",
      severity: "medium",
      location: "whole_answer",
      evidence: "回答没有提供具体经历。",
      why_it_matters: "面试官无法判断动机是否来自真实经历。"
    }
  ],
  quality_flags: []
};

const validCoaching = {
  score: {
    total: 68,
    score_band: "basic",
    learning_level: "Level 1",
    summary: "回答直接，但证据偏少。"
  },
  dimension_scores: validAnalysis.dimension_scores.map((item) => ({
    ...item,
    display_name: item.dimension
  })),
  diagnosis: [
    {
      issue_id: "D001",
      issue_type: "lack_example",
      severity: "medium",
      location: "whole_answer",
      title: "缺少具体经历支撑",
      evidence: "回答没有提供具体经历。",
      why_it_matters: "面试官无法判断动机是否来自真实经历。",
      fix_direction: "补充一个真实学习或工作场景。"
    }
  ],
  rewrite: {
    version_type: "coach_rewrite",
    rewrite_goal: "把动机表达得更具体。",
    structure_used: "Conclusion First + Supporting Reason",
    text: "我想做数据分析，是因为我喜欢把复杂问题讲清楚，并用分析结果支持业务判断。",
    fact_preservation_note: "没有新增用户未提供的经历、数据或公司。"
  },
  why_better: [
    {
      change_type: "opening_upgrade",
      changed_what: "保留开头结论，并让原因更集中。",
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
  quality_flags: []
};

function createRepository(): AttemptRepository & {
  statuses: AttemptStatus[];
  latestScore: () => ScoreRow | null;
  latestFeedback: () => AiFeedbackRow | null;
  latestAttempt: () => AttemptRow;
} {
  let currentAttempt = attempt;
  let latestScore: ScoreRow | null = null;
  let latestFeedback: AiFeedbackRow | null = null;
  const statuses: AttemptStatus[] = [];

  return {
    statuses,
    latestScore: () => latestScore,
    latestFeedback: () => latestFeedback,
    latestAttempt: () => currentAttempt,
    async findActiveQuestionById() {
      return question;
    },
    async findAttemptByIdempotencyKey() {
      return null;
    },
    async createAttempt() {
      return currentAttempt;
    },
    async updateAttemptStatus(_userId, _attemptId, status) {
      currentAttempt = {
        ...currentAttempt,
        status
      };
      statuses.push(status);
      return currentAttempt;
    },
    async updateAttemptPipelineMetadata(_userId, _attemptId, metadata) {
      currentAttempt = {
        ...currentAttempt,
        ...metadata
      };
      return currentAttempt;
    },
    async findAttemptById() {
      return currentAttempt;
    },
    async findScoreByAttemptId() {
      return latestScore;
    },
    async createScore(score: ScoreInsert) {
      latestScore = {
        ...score,
        created_at: "2026-06-19T00:00:00.000Z"
      };
      return latestScore;
    },
    async findAiFeedbackByAttemptId() {
      return latestFeedback;
    },
    async createAiFeedback(feedback: AiFeedbackInsert) {
      latestFeedback = {
        ...feedback,
        created_at: "2026-06-19T00:00:00.000Z"
      };
      return latestFeedback;
    }
  };
}

function aiClientWithOutputs(outputs: string[]): StgAiClient {
  let index = 0;
  return {
    async generateJson() {
      const output = outputs[index++];
      if (output === undefined) {
        throw new Error("No mock output left");
      }

      return {
        text: output,
        model: "mock-model",
        latencyMs: 12
      };
    }
  };
}

describe("Module 8 real AI pipeline", () => {
  it("loads immutable active prompt files from the manifest", () => {
    const resolver = createPromptResolver();
    const analysis = resolver.getActivePrompt("analysis");
    const coaching = resolver.getActivePrompt("coaching");

    expect(analysis.version).toBe("analysis/v1");
    expect(analysis.system).toContain("STG Analysis Engine v1");
    expect(coaching.version).toBe("coaching/v1");
    expect(coaching.userTemplate).toContain("{{analysis\\_json}}");
  });

  it("validates Analysis output and rejects rewrite fields", () => {
    expect(AnalysisOutputSchema.parse(validAnalysis).score.total).toBe(68);
    expect(() =>
      AnalysisOutputSchema.parse({
        ...validAnalysis,
        rewrite: {
          text: "not allowed"
        }
      })
    ).toThrow(z.ZodError);
  });

  it("validates Coaching output and rejects score changes from Analysis", () => {
    const coaching = CoachingOutputSchema.parse(validCoaching);
    expect(() =>
      validateCoachingMatchesAnalysis(
        {
          ...coaching,
          score: {
            ...coaching.score,
            total: 88
          }
        },
        AnalysisOutputSchema.parse(validAnalysis)
      )
    ).toThrow("Coaching score must inherit Analysis score.");
  });

  it("runs Analysis and Coaching as two successful calls and persists live output", async () => {
    const repository = createRepository();
    await runAiCoachPipeline({
      mode: "live",
      userId: "user-1",
      attempt,
      question,
      repository,
      aiClient: aiClientWithOutputs([
        JSON.stringify(validAnalysis),
        JSON.stringify(validCoaching)
      ])
    });

    expect(repository.statuses).toEqual([
      "analysis_running",
      "coaching_running",
      "completed"
    ]);
    expect(repository.latestScore()).toMatchObject({
      answer_relevance: 15,
      core_message: 12,
      structure: 16,
      evidence: 13,
      interview_impact: 12,
      total_score: 68
    });
    expect(repository.latestFeedback()).toMatchObject({
      question_analysis: validAnalysis.question_analysis,
      observable_features: validAnalysis.observable_features,
      diagnosis: validCoaching.diagnosis,
      safety_flags: []
    });
    expect(repository.latestAttempt()).toMatchObject({
      analysis_prompt_version: "analysis/v1",
      coaching_prompt_version: "coaching/v1",
      ai_model: "mock-model",
      repair_count: 0
    });
  });

  it("repairs invalid Analysis JSON at most once", async () => {
    const repository = createRepository();
    await runAiCoachPipeline({
      mode: "live",
      userId: "user-1",
      attempt,
      question,
      repository,
      aiClient: aiClientWithOutputs([
        "{ invalid json",
        JSON.stringify(validAnalysis),
        JSON.stringify(validCoaching)
      ])
    });

    expect(repository.latestAttempt().repair_count).toBe(1);
    expect(repository.latestAttempt().status).toBe("completed");
  });

  it("fails the attempt when repair also fails", async () => {
    const repository = createRepository();

    await expect(
      runAiCoachPipeline({
        mode: "live",
        userId: "user-1",
        attempt,
        question,
        repository,
        aiClient: aiClientWithOutputs(["not json", "still not json"])
      })
    ).rejects.toThrow("Analysis output failed schema validation.");

    expect(repository.latestAttempt()).toMatchObject({
      status: "failed",
      error_code: "ANALYSIS_VALIDATION_FAILED",
      repair_count: 1
    });
  });

  it("repairs invalid Coaching JSON once", async () => {
    const repository = createRepository();
    await runAiCoachPipeline({
      mode: "live",
      userId: "user-1",
      attempt,
      question,
      repository,
      aiClient: aiClientWithOutputs([
        JSON.stringify(validAnalysis),
        "{ invalid coaching",
        JSON.stringify(validCoaching)
      ])
    });

    expect(repository.latestAttempt()).toMatchObject({
      status: "completed",
      repair_count: 1
    });
  });

  it("regenerates coaching once when fact guard detects invented facts", async () => {
    const repository = createRepository();
    const invented = {
      ...validCoaching,
      rewrite: {
        ...validCoaching.rewrite,
        text: "我用 SQL 把业务指标提升了 30%，所以想做数据分析。"
      }
    };

    await runAiCoachPipeline({
      mode: "live",
      userId: "user-1",
      attempt,
      question,
      repository,
      aiClient: aiClientWithOutputs([
        JSON.stringify(validAnalysis),
        JSON.stringify(invented),
        JSON.stringify(validCoaching)
      ])
    });

    expect(repository.latestFeedback()?.safety_flags).toEqual([
      {
        flag_type: "fact_guard_regenerated",
        severity: "medium",
        message: "Initial coaching rewrite introduced unsupported facts."
      }
    ]);
  });

  it("handles OpenAI timeout by marking the attempt failed", async () => {
    const repository = createRepository();

    await expect(
      runAiCoachPipeline({
        mode: "live",
        userId: "user-1",
        attempt,
        question,
        repository,
        aiClient: {
          async generateJson() {
            throw new Error("Request timeout");
          }
        }
      })
    ).rejects.toThrow("AI pipeline request failed.");

    expect(repository.latestAttempt()).toMatchObject({
      status: "failed",
      error_code: "AI_TIMEOUT"
    });
  });

  it("does not fall back to mock in production when OPENAI_API_KEY is missing", () => {
    expect(() =>
      getAiRuntimeConfig({
        NODE_ENV: "production",
        STG_AI_MODE: undefined,
        OPENAI_API_KEY: undefined
      })
    ).toThrow("OPENAI_API_KEY is required in live mode.");
  });

  it("switches explicitly between mock and live mode", () => {
    expect(
      getAiRuntimeConfig({
        NODE_ENV: "development",
        STG_AI_MODE: "mock",
        OPENAI_API_KEY: undefined
      }).mode
    ).toBe("mock");
    expect(
      getAiRuntimeConfig({
        NODE_ENV: "development",
        STG_AI_MODE: "live",
        OPENAI_API_KEY: "test-key"
      }).mode
    ).toBe("live");
  });
});
