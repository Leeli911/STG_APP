import type {
  AiFeedbackRow,
  AttemptRow,
  ScoreRow
} from "@/server/attempts/types";
import type {
  DeductionDto,
  DimensionKey,
  ExplainableDimensionDto,
  FeedbackReadyTrainingSessionDto,
  PracticeSessionRow,
  RevisionEventRow,
  SourceMode
} from "@/server/training-sessions/types";
import type { TrainingSessionDto } from "@/server/training-sessions/types";

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
  attempt,
  score,
  feedback
}: {
  sessionId: string;
  sourceMode: SourceMode;
  feedbackMode: "D";
  attempt: AttemptRow;
  score: ScoreRow;
  feedback: AiFeedbackRow;
}): FeedbackReadyTrainingSessionDto {
  return {
    id: sessionId,
    sourceMode,
    feedbackMode: "D",
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

export function toTrainingSessionDto({
  session,
  revision,
  initialAttempt,
  initialScore,
  initialFeedback,
  finalAttempt = null,
  finalScore = null,
  finalFeedback = null
}: {
  session: PracticeSessionRow;
  revision: RevisionEventRow | null;
  initialAttempt: AttemptRow;
  initialScore: ScoreRow;
  initialFeedback: AiFeedbackRow;
  finalAttempt?: AttemptRow | null;
  finalScore?: ScoreRow | null;
  finalFeedback?: AiFeedbackRow | null;
}): TrainingSessionDto {
  const feedbackReady = toFeedbackReadyTrainingSessionDto({
    sessionId: session.id,
    sourceMode: "live",
    feedbackMode: "D",
    attempt: initialAttempt,
    score: initialScore,
    feedback: initialFeedback
  });
  const shared = {
    ...feedbackReady,
    feedbackShownAt: session.feedback_shown_at
  };

  if (session.status === "feedback_ready") {
    return shared;
  }

  if (!revision || !finalAttempt) {
    throw new Error("Revision session is missing its committed decision or final attempt.");
  }

  const decision = {
    action: revision.action,
    editedText: revision.edited_text,
    decidedAt: revision.client_decided_at ?? revision.created_at,
    idempotencyKey: revision.idempotency_key
  };
  const final = {
    text: finalAttempt.original_answer,
    attemptId: finalAttempt.id,
    submittedAt: finalAttempt.created_at
  };

  if (session.status === "completed") {
    if (!finalScore || !finalFeedback) {
      throw new Error("Completed revision session is missing its final result.");
    }

    return {
      ...shared,
      status: "completed",
      decision,
      final,
      scoreAfter: toScoreSnapshot(finalScore, finalFeedback),
      delta: null
    };
  }

  return {
    ...shared,
    status: session.status,
    decision,
    final,
    scoreAfter: null,
    delta: null
  };
}

function toScoreSnapshot(score: ScoreRow, feedback: AiFeedbackRow) {
  return {
    total: score.total_score,
    dimensions: toExplainableDimensions(score, feedback)
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
