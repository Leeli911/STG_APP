import type { AttemptStatus } from "@/server/attempts/types";
import type { TrainingDayNumber } from "@/server/questions/types";
import type {
  PracticeSessionStatus,
  RevisionAction
} from "@/server/training-sessions/types";

export const trainingDayCount = 7;

export type TrainingProgressSummary = {
  currentDay: TrainingDayNumber;
  completedDays: TrainingDayNumber[];
  isComplete: boolean;
  totalDays: typeof trainingDayCount;
};

export type TrainingOverviewQuestion = {
  id: string;
  dayNumber: TrainingDayNumber;
  title: string;
  prompt: string;
  learningGoal: string;
};

export type TrainingHistoryStatus = PracticeSessionStatus | AttemptStatus;

export type TrainingHistoryItem = {
  id: string;
  initialAttemptId: string;
  finalAttemptId: string | null;
  practiceDay: TrainingDayNumber;
  title: string;
  status: TrainingHistoryStatus;
  source: "practice_session" | "legacy_attempt";
  createdAt: string;
  completedAt: string | null;
  decision: RevisionAction | null;
  originalAnswer: string;
  finalAnswer: string | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  delta: number | null;
  promptVersion: string | null;
  rubricVersion: string | null;
  modelVersion: string | null;
  href: string;
};

export type WeakestDimension = {
  key:
    | "answer_relevance"
    | "core_message"
    | "structure"
    | "evidence"
    | "interview_impact";
  label: string;
  average: number;
};

export type TrainingOverview = {
  progress: TrainingProgressSummary;
  todayQuestion: TrainingOverviewQuestion | null;
  history: TrainingHistoryItem[];
  latestCompleted: TrainingHistoryItem | null;
  weakestDimension: WeakestDimension | null;
};

export type OverviewPracticeSessionRow = {
  id: string;
  user_id: string;
  initial_attempt_id: string;
  final_attempt_id: string | null;
  practice_day: number;
  status: PracticeSessionStatus;
  created_at: string;
  completed_at: string | null;
};

export type OverviewAttemptRow = {
  id: string;
  day_number: number;
  original_answer: string;
  status: AttemptStatus;
  created_at: string;
  question_title: string;
  analysis_prompt_version?: string | null;
  coaching_prompt_version?: string | null;
  rubric_version?: string | null;
  ai_model?: string | null;
};

export type OverviewScoreRow = {
  attempt_id: string;
  answer_relevance: number;
  core_message: number;
  structure: number;
  evidence: number;
  interview_impact: number;
  total_score: number;
};

export type OverviewRevisionRow = {
  session_id: string;
  action: RevisionAction;
  created_at: string;
};

export type OverviewQuestionRow = {
  id: string;
  day_number: number;
  title: string;
  prompt: string;
  learning_goal: string;
};

export type TrainingOverviewRepository = {
  listPracticeSessions(userId: string): Promise<OverviewPracticeSessionRow[]>;
  listAttempts(userId: string): Promise<OverviewAttemptRow[]>;
  listScores(): Promise<OverviewScoreRow[]>;
  listRevisions(): Promise<OverviewRevisionRow[]>;
  listActiveQuestions(): Promise<OverviewQuestionRow[]>;
};
