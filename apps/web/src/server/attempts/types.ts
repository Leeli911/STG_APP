import type { TrainingDayNumber } from "@/server/questions";

export type AttemptStatus =
  | "submitted"
  | "analysis_running"
  | "coaching_running"
  | "mock_result_generating"
  | "completed"
  | "failed";

export type AttemptQuestionRow = {
  id: string;
  day_number: number;
  is_active: boolean;
  title?: string;
  scenario?: string;
  prompt?: string;
  learning_goal?: string;
  expected_structure?: string;
  evaluation_focus?: string;
};

export type AttemptRow = {
  id: string;
  user_id: string;
  question_id: string;
  day_number: number;
  original_answer: string;
  status: AttemptStatus;
  idempotency_key: string;
  client_started_at: string | null;
  created_at: string;
  analysis_prompt_version?: string | null;
  coaching_prompt_version?: string | null;
  ai_model?: string | null;
  repair_count?: number | null;
  error_code?: string | null;
  analysis_latency_ms?: number | null;
  coaching_latency_ms?: number | null;
  total_latency_ms?: number | null;
};

export type AttemptInsert = {
  userId: string;
  questionId: string;
  answerText: string;
  idempotencyKey: string;
  clientStartedAt?: string | null;
};

export type AttemptDto = {
  id: string;
  questionId: string;
  dayNumber: TrainingDayNumber;
  answerText: string;
  status: AttemptStatus;
  submittedAt: string;
};

export type ScoreRow = {
  attempt_id: string;
  answer_relevance: number;
  core_message: number;
  structure: number;
  evidence: number;
  interview_impact: number;
  total_score: number;
  rubric_evidence?: Record<string, unknown> | null;
  created_at: string;
};

export type ScoreInsert = Omit<ScoreRow, "created_at">;

export type DiagnosisItem = {
  issue_id?: string;
  issue_type: string;
  severity: string;
  location?: string;
  title?: string;
  evidence: string;
  why_it_matters: string;
  fix_direction?: string;
};

export type RewriteFeedback = {
  rewrite_goal: string;
  structure_used: string;
  text: string;
  fact_preservation_note: string;
};

export type WhyBetterItem = {
  change_type?: string;
  changed_what: string;
  why_changed: string;
  impact: string;
};

export type GrowthSuggestion = {
  focus_for_next_practice: string;
  micro_drill: string;
  example_sentence_frame: string;
  estimated_next_level: string;
};

export type AiFeedbackRow = {
  attempt_id: string;
  question_analysis?: Record<string, unknown> | null;
  observable_features?: Record<string, unknown> | null;
  diagnosis: DiagnosisItem[];
  rewrite: RewriteFeedback;
  why_better: WhyBetterItem[];
  growth_suggestion: GrowthSuggestion;
  safety_flags?: Array<Record<string, unknown>> | null;
  created_at: string;
};

export type AiFeedbackInsert = Omit<AiFeedbackRow, "created_at">;

export type CompletedAttemptResultDto = {
  attempt: {
    status: "completed";
    originalAnswer: string;
    submittedAt: string;
    feedbackMode?: "mock" | "live";
  };
  score: {
    total: number;
    answer_relevance: number;
    core_message: number;
    structure: number;
    evidence: number;
    interview_impact: number;
  };
  diagnosis: DiagnosisItem[];
  rewrite: RewriteFeedback;
  whyBetter: WhyBetterItem[];
  growthSuggestion: GrowthSuggestion;
};

export type FailedAttemptResultDto = {
  attempt: {
    status: "failed";
    originalAnswer: string;
    submittedAt: string;
    retryAvailable: true;
  };
};

export type AttemptResultDto = CompletedAttemptResultDto | FailedAttemptResultDto;

export type AttemptRepository = {
  findActiveQuestionById: (questionId: string) => Promise<AttemptQuestionRow | null>;
  findAttemptByIdempotencyKey: (
    userId: string,
    idempotencyKey: string
  ) => Promise<AttemptRow | null>;
  createAttempt: (insert: AttemptInsert) => Promise<AttemptRow>;
  updateAttemptStatus: (
    userId: string,
    attemptId: string,
    status: AttemptStatus
  ) => Promise<AttemptRow>;
  findAttemptById: (
    userId: string,
    attemptId: string
  ) => Promise<AttemptRow | null>;
  findScoreByAttemptId: (attemptId: string) => Promise<ScoreRow | null>;
  createScore: (score: ScoreInsert) => Promise<ScoreRow>;
  findAiFeedbackByAttemptId: (
    attemptId: string
  ) => Promise<AiFeedbackRow | null>;
  createAiFeedback: (feedback: AiFeedbackInsert) => Promise<AiFeedbackRow>;
  updateAttemptPipelineMetadata?: (
    userId: string,
    attemptId: string,
    metadata: Partial<
      Pick<
        AttemptRow,
        | "analysis_prompt_version"
        | "coaching_prompt_version"
        | "ai_model"
        | "repair_count"
        | "error_code"
        | "analysis_latency_ms"
        | "coaching_latency_ms"
        | "total_latency_ms"
      >
    >
  ) => Promise<AttemptRow>;
};
