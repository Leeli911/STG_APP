import { z } from "zod";

const ScoreBandSchema = z.enum(["excellent", "strong", "good", "basic", "weak", "poor"]);
const LearningLevelSchema = z.enum(["Level 1", "Level 2", "Level 3", "Level 4"]);
const SeveritySchema = z.enum(["high", "medium", "low"]);
const LocationSchema = z.enum(["opening", "middle", "ending", "whole_answer"]);
const DimensionSchema = z.enum([
  "relevance",
  "core_message",
  "structure",
  "evidence",
  "interview_impact"
]);

const dimensionMaxScore: Record<z.infer<typeof DimensionSchema>, number> = {
  relevance: 20,
  core_message: 20,
  structure: 25,
  evidence: 20,
  interview_impact: 15
};

const DeductionSchema = z.object({
  rule: z.string(),
  points: z.number(),
  reason: z.string()
});

const AnalysisDimensionScoreSchema = z.object({
  dimension: DimensionSchema,
  score: z.number().int().min(0),
  max_score: z.number().int().positive(),
  evidence: z.string().min(1),
  deductions: z.array(DeductionSchema)
});

const CoachingDimensionScoreSchema = AnalysisDimensionScoreSchema.extend({
  display_name: z.string().min(1)
});

const ScoreSchema = z.object({
  total: z.number().int().min(0).max(100),
  score_band: ScoreBandSchema,
  learning_level: LearningLevelSchema
});

const QualityFlagSchema = z.object({
  flag_type: z.string(),
  severity: SeveritySchema,
  message: z.string()
});

export const AnalysisOutputSchema = z
  .object({
    question_analysis: z.object({
      question_type: z.enum([
        "self_introduction",
        "project_experience",
        "behavioral",
        "motivation",
        "strength_weakness",
        "career_plan",
        "technical",
        "business_case",
        "other"
      ]),
      expected_structure: z.string(),
      requires_example: z.boolean(),
      requires_metric: z.boolean(),
      requires_role_fit: z.boolean()
    }),
    observable_features: z.object({
      answer_length_chars: z.number().int().min(0),
      main_point_position: z.object({
        status: z.enum(["first_sentence", "early", "middle", "late", "missing"]),
        char_index: z.number().int().min(0),
        evidence: z.string()
      }),
      has_clear_opening_claim: z.boolean(),
      has_structure_markers: z.boolean(),
      has_specific_example: z.boolean(),
      has_personal_action: z.boolean(),
      has_result: z.boolean(),
      has_metric: z.boolean(),
      has_role_fit: z.boolean(),
      repetition_level: z.enum(["none", "low", "medium", "high"]),
      off_topic_level: z.enum(["none", "low", "medium", "high"]),
      star_completeness: z.object({
        situation: z.boolean(),
        task: z.boolean(),
        action: z.boolean(),
        result: z.boolean()
      })
    }),
    score: ScoreSchema,
    dimension_scores: z.array(AnalysisDimensionScoreSchema).length(5),
    diagnosis: z
      .array(
        z.object({
          issue_id: z.string(),
          issue_type: z.enum([
            "missing_core_message",
            "late_core_message",
            "vague_core_message",
            "no_clear_structure",
            "background_too_long",
            "action_missing",
            "result_missing",
            "lack_example",
            "lack_metric",
            "repetition",
            "unsupported_claim",
            "weak_role_fit",
            "over_humble",
            "overclaim",
            "off_topic",
            "other"
          ]),
          severity: SeveritySchema,
          location: LocationSchema,
          evidence: z.string().min(1),
          why_it_matters: z.string().min(1)
        })
      )
      .min(1)
      .max(5),
    quality_flags: z.array(QualityFlagSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    validateDimensionScores(value.dimension_scores, ctx);
    const total = sumDimensionScores(value.dimension_scores);
    if (value.score.total !== total) {
      ctx.addIssue({
        code: "custom",
        path: ["score", "total"],
        message: "score.total must equal dimension_scores sum."
      });
    }
  });

export const CoachingOutputSchema = z
  .object({
    score: ScoreSchema.extend({
      summary: z.string()
    }),
    dimension_scores: z.array(CoachingDimensionScoreSchema).length(5),
    diagnosis: z
      .array(
        z.object({
          issue_id: z.string(),
          issue_type: z.string(),
          severity: SeveritySchema,
          location: LocationSchema,
          title: z.string(),
          evidence: z.string().min(1),
          why_it_matters: z.string().min(1),
          fix_direction: z.string().min(1)
        })
      )
      .min(1)
      .max(5),
    rewrite: z.object({
      version_type: z.literal("coach_rewrite"),
      rewrite_goal: z.string().min(1),
      structure_used: z.string().min(1),
      text: z.string().min(1),
      fact_preservation_note: z.string().min(1)
    }),
    why_better: z
      .array(
        z.object({
          change_type: z.enum([
            "opening_upgrade",
            "structure_upgrade",
            "evidence_upgrade",
            "interview_fit_upgrade",
            "concision_upgrade",
            "tone_upgrade"
          ]),
          changed_what: z.string().min(1),
          why_changed: z.string().min(1),
          impact: z.string().min(1)
        })
      )
      .min(1),
    growth_suggestion: z.object({
      focus_for_next_practice: z.string().min(1),
      micro_drill: z.string().min(1),
      example_sentence_frame: z.string().min(1),
      estimated_next_level: LearningLevelSchema
    }),
    quality_flags: z.array(QualityFlagSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    validateDimensionScores(value.dimension_scores, ctx);
    const total = sumDimensionScores(value.dimension_scores);
    if (value.score.total !== total) {
      ctx.addIssue({
        code: "custom",
        path: ["score", "total"],
        message: "score.total must equal dimension_scores sum."
      });
    }
  });

export const RepairOutputSchema = z.union([
  AnalysisOutputSchema,
  CoachingOutputSchema
]);

export const JudgeOutputSchema = z.object({
  result: z.enum(["pass", "fail"]),
  overall_reason: z.string(),
  checks: z.record(
    z.string(),
    z.object({
      pass: z.boolean(),
      reason: z.string()
    })
  ),
  failure_items: z.array(
    z.object({
      severity: z.enum(["critical", "major", "minor"]),
      location: z.string(),
      problem: z.string(),
      repair_hint: z.string()
    })
  ),
  recommended_action: z.enum(["accept", "repair", "regenerate"])
});

export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;
export type CoachingOutput = z.infer<typeof CoachingOutputSchema>;
export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

export const AnalysisStructuredOutput = {
  name: "stg_analysis_v1",
  schema: toOpenAiJsonSchema(AnalysisOutputSchema)
} as const;

export const CoachingStructuredOutput = {
  name: "stg_coaching_v1",
  schema: toOpenAiJsonSchema(CoachingOutputSchema)
} as const;

export function validateCoachingMatchesAnalysis(
  coaching: CoachingOutput,
  analysis: AnalysisOutput
) {
  if (coaching.score.total !== analysis.score.total) {
    throw new Error("Coaching score must inherit Analysis score.");
  }

  for (const analysisDimension of analysis.dimension_scores) {
    const coachingDimension = coaching.dimension_scores.find(
      (item) => item.dimension === analysisDimension.dimension
    );

    if (!coachingDimension || coachingDimension.score !== analysisDimension.score) {
      throw new Error("Coaching score must inherit Analysis score.");
    }
  }
}

function validateDimensionScores(
  dimensions: Array<{ dimension: keyof typeof dimensionMaxScore; score: number; max_score: number }>,
  ctx: z.RefinementCtx
) {
  const seen = new Set<string>();

  for (const [index, item] of dimensions.entries()) {
    seen.add(item.dimension);
    const expectedMax = dimensionMaxScore[item.dimension];

    if (item.max_score !== expectedMax) {
      ctx.addIssue({
        code: "custom",
        path: ["dimension_scores", index, "max_score"],
        message: "dimension max_score does not match rubric."
      });
    }

    if (item.score > expectedMax) {
      ctx.addIssue({
        code: "custom",
        path: ["dimension_scores", index, "score"],
        message: "dimension score exceeds max_score."
      });
    }
  }

  for (const dimension of Object.keys(dimensionMaxScore)) {
    if (!seen.has(dimension)) {
      ctx.addIssue({
        code: "custom",
        path: ["dimension_scores"],
        message: `missing dimension ${dimension}.`
      });
    }
  }
}

function sumDimensionScores(
  dimensions: Array<{ score: number }>
) {
  return dimensions.reduce((total, item) => total + item.score, 0);
}

function toOpenAiJsonSchema(schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-7",
    io: "output"
  });
  delete jsonSchema.$schema;
  return jsonSchema;
}
