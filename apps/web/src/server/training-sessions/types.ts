import type { DiagnosisItem, WhyBetterItem } from "@/server/attempts/types";

export type SourceMode = "demo" | "live";
export type FeedbackMode = "A" | "B" | "C" | "D";

export type DimensionKey =
  | "relevance"
  | "core_message"
  | "structure"
  | "evidence"
  | "interview_impact";

export type DeductionDto = {
  rule: string;
  points: number;
  reason: string;
};

export type ExplainableDimensionDto = {
  dimension: DimensionKey;
  displayName: string;
  score: number;
  maxScore: number;
  evidence: string;
  deductions: DeductionDto[];
  improvementFocus: string | null;
};

export type ScoreSnapshotDto = {
  total: number;
  dimensions: ExplainableDimensionDto[];
};

export type FeedbackReadyTrainingSessionDto = {
  id: string;
  sourceMode: SourceMode;
  feedbackMode: FeedbackMode;
  practiceDay: number;
  status: "feedback_ready";
  draft: {
    text: string;
    attemptId: string;
    submittedAt: string;
  };
  diagnosis: DiagnosisItem[];
  suggestion: {
    text: string;
    structureUsed: string;
    whyBetter: WhyBetterItem[];
  };
  scoreBefore: ScoreSnapshotDto;
  decision: null;
  final: null;
  scoreAfter: null;
  delta: null;
  feedbackShownAt: string | null;
};
