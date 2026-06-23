import type {
  AiFeedbackRow,
  AttemptRow,
  ScoreRow
} from "@/server/attempts/types";
import type {
  DeductionDto,
  DimensionKey,
  ExplainableDimensionDto,
  FeedbackMode,
  FeedbackReadyTrainingSessionDto,
  SourceMode
} from "@/server/training-sessions/types";

const dimensionKeys = new Set<DimensionKey>([
  "relevance",
  "core_message",
  "structure",
  "evidence",
  "interview_impact"
]);

const dimensionLabels: Record<DimensionKey, string> = {
  relevance: "Answer Relevance",
  core_message: "Core Message",
  structure: "Structure",
  evidence: "Evidence",
  interview_impact: "Interview Impact"
};

const issueDimensions: Partial<Record<string, DimensionKey>> = {
  off_topic: "relevance",
  missing_core_message: "core_message",
  late_core_message: "core_message",
  vague_core_message: "core_message",
  background_too_long: "core_message",
  no_clear_structure: "structure",
  action_missing: "structure",
  result_missing: "structure",
  lack_example: "evidence",
  lack_metric: "evidence",
  unsupported_claim: "evidence",
  repetition: "interview_impact",
  weak_role_fit: "interview_impact",
  over_humble: "interview_impact",
  overclaim: "interview_impact"
};

type RawDimensionScore = {
  dimension: DimensionKey;
  score: number;
  max_score: number;
  evidence: string;
  deductions: DeductionDto[];
};

export function toFeedbackReadyTrainingSessionDto({
  sessionId,
  sourceMode,
  feedbackMode,
  attempt,
  score,
  feedback
}: {
  sessionId: string;
  sourceMode: SourceMode;
  feedbackMode: FeedbackMode;
  attempt: AttemptRow;
  score: ScoreRow;
  feedback: AiFeedbackRow;
}): FeedbackReadyTrainingSessionDto {
  return {
    id: sessionId,
    sourceMode,
    feedbackMode,
    practiceDay: attempt.day_number,
    status: "feedback_ready",
    draft: {
      text: attempt.original_answer,
      attemptId: attempt.id,
      submittedAt: attempt.created_at
    },
    diagnosis: feedback.diagnosis,
    suggestion: {
      text: feedback.rewrite.text,
      structureUsed: feedback.rewrite.structure_used,
      whyBetter: feedback.why_better
    },
    scoreBefore: {
      total: score.total_score,
      dimensions: toExplainableDimensions(score, feedback)
    },
    decision: null,
    final: null,
    scoreAfter: null,
    delta: null,
    feedbackShownAt: null
  };
}

function toExplainableDimensions(
  score: ScoreRow,
  feedback: AiFeedbackRow
): ExplainableDimensionDto[] {
  const dimensions = readDimensionScores(score.rubric_evidence);

  return dimensions.map((item) => ({
    dimension: item.dimension,
    displayName: dimensionLabels[item.dimension],
    score: item.score,
    maxScore: item.max_score,
    evidence: item.evidence,
    deductions: item.deductions,
    improvementFocus: findImprovementFocus(item.dimension, feedback)
  }));
}

function findImprovementFocus(
  dimension: DimensionKey,
  feedback: AiFeedbackRow
) {
  const diagnosis = feedback.diagnosis.find(
    (item) =>
      issueDimensions[item.issue_type] === dimension &&
      typeof item.fix_direction === "string" &&
      item.fix_direction.trim().length > 0
  );

  return diagnosis?.fix_direction?.trim() ?? null;
}

function readDimensionScores(
  rubricEvidence: Record<string, unknown> | null | undefined
): RawDimensionScore[] {
  if (!rubricEvidence || !Array.isArray(rubricEvidence.dimension_scores)) {
    return [];
  }

  return rubricEvidence.dimension_scores.filter(isRawDimensionScore);
}

function isRawDimensionScore(value: unknown): value is RawDimensionScore {
  if (!isRecord(value) || !isDimensionKey(value.dimension)) {
    return false;
  }

  return (
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    typeof value.max_score === "number" &&
    Number.isFinite(value.max_score) &&
    typeof value.evidence === "string" &&
    Array.isArray(value.deductions) &&
    value.deductions.every(isDeduction)
  );
}

function isDeduction(value: unknown): value is DeductionDto {
  return (
    isRecord(value) &&
    typeof value.rule === "string" &&
    typeof value.points === "number" &&
    Number.isFinite(value.points) &&
    typeof value.reason === "string"
  );
}

function isDimensionKey(value: unknown): value is DimensionKey {
  return typeof value === "string" && dimensionKeys.has(value as DimensionKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
