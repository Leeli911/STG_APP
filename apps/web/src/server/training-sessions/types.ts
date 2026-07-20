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

export type ScoreDeltaDto = {
  total: number;
  dimensions: Array<{
    dimension: DimensionKey;
    before: number;
    after: number;
    delta: number;
  }>;
};

export type RevisionAction = "accepted" | "rejected" | "edited";

export type PracticeSessionStatus =
  | "feedback_ready"
  | "rescoring"
  | "rescore_failed"
  | "completed";

export type PracticeSessionRow = {
  id: string;
  user_id: string;
  initial_attempt_id: string;
  final_attempt_id: string | null;
  idempotency_key: string;
  practice_day: number;
  feedback_mode: "D";
  feedback_shown_at: string | null;
  status: PracticeSessionStatus;
  created_at: string;
  completed_at: string | null;
};

export type RevisionEventRow = {
  id: string;
  session_id: string;
  idempotency_key: string;
  action: RevisionAction;
  edited_text: string | null;
  client_decided_at: string | null;
  created_at: string;
};

type SharedFeedbackTrainingSessionDto = {
  id: string;
  sourceMode: SourceMode;
  feedbackMode: "D";
  practiceDay: number;
  /** Version snapshot used to make before/after scores auditable. */
  promptVersion: string;
  rubricVersion: string;
  modelVersion: string;
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
  feedbackShownAt: string | null;
};

export type FeedbackReadyTrainingSessionDto =
  SharedFeedbackTrainingSessionDto & {
  status: "feedback_ready";
  decision: null;
  final: null;
  scoreAfter: null;
  delta: null;
};

export type TrainingSessionDecisionDto = {
  action: RevisionAction;
  editedText: string | null;
  decidedAt: string;
  idempotencyKey: string;
};

export type TrainingSessionFinalDto = {
  text: string;
  attemptId: string;
  submittedAt: string;
};

export type RescoringTrainingSessionDto = SharedFeedbackTrainingSessionDto & {
  status: "rescoring";
  decision: TrainingSessionDecisionDto;
  final: TrainingSessionFinalDto;
  scoreAfter: null;
  delta: null;
};

export type RescoreFailedTrainingSessionDto =
  SharedFeedbackTrainingSessionDto & {
  status: "rescore_failed";
  decision: TrainingSessionDecisionDto;
  final: TrainingSessionFinalDto;
  scoreAfter: null;
  delta: null;
};

export type CompletedTrainingSessionDto = SharedFeedbackTrainingSessionDto & {
  status: "completed";
  decision: TrainingSessionDecisionDto;
  final: TrainingSessionFinalDto;
  scoreAfter: ScoreSnapshotDto;
  /** Always derived from immutable score snapshots; never persisted as authority. */
  delta: ScoreDeltaDto | null;
};

export type TrainingSessionDto =
  | FeedbackReadyTrainingSessionDto
  | RescoringTrainingSessionDto
  | RescoreFailedTrainingSessionDto
  | CompletedTrainingSessionDto;
