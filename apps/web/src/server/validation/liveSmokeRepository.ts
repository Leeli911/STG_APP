import type { GoldenCase } from "@/server/benchmarks/goldenSet";
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

export type LiveSmokeSnapshot = {
  attempt: AttemptRow;
  statuses: AttemptStatus[];
  score: ScoreRow | null;
  feedback: AiFeedbackRow | null;
};

export function createLiveSmokeRepository(goldenCase: GoldenCase): {
  userId: string;
  question: AttemptQuestionRow;
  attempt: AttemptRow;
  repository: AttemptRepository;
  getSnapshot: () => LiveSmokeSnapshot;
} {
  const userId = "live-smoke-user";
  const question: AttemptQuestionRow = {
    id: `live-smoke-question-${goldenCase.id}`,
    day_number: 1,
    is_active: true,
    title: goldenCase.title,
    scenario: "Golden Set V1 live smoke validation",
    prompt: goldenCase.question,
    expected_structure: goldenCase.expected_analysis_raw
  };
  let currentAttempt: AttemptRow = {
    id: `live-smoke-attempt-${goldenCase.id}`,
    user_id: userId,
    question_id: question.id,
    day_number: 1,
    original_answer: goldenCase.user_answer,
    status: "submitted",
    idempotency_key: `live-smoke-${goldenCase.id}`,
    client_started_at: null,
    created_at: new Date().toISOString()
  };
  const statuses: AttemptStatus[] = [];
  let score: ScoreRow | null = null;
  let feedback: AiFeedbackRow | null = null;

  const repository: AttemptRepository = {
    async findActiveQuestionById(questionId) {
      return questionId === question.id ? question : null;
    },
    async findAttemptByIdempotencyKey() {
      return null;
    },
    async createAttempt() {
      return currentAttempt;
    },
    async updateAttemptStatus(requestUserId, attemptId, status) {
      assertAttemptOwner(requestUserId, attemptId, userId, currentAttempt.id);
      currentAttempt = {
        ...currentAttempt,
        status
      };
      statuses.push(status);
      return currentAttempt;
    },
    async updateAttemptPipelineMetadata(requestUserId, attemptId, metadata) {
      assertAttemptOwner(requestUserId, attemptId, userId, currentAttempt.id);
      currentAttempt = {
        ...currentAttempt,
        ...metadata
      };
      return currentAttempt;
    },
    async findAttemptById(requestUserId, attemptId) {
      return requestUserId === userId && attemptId === currentAttempt.id
        ? currentAttempt
        : null;
    },
    async findScoreByAttemptId(attemptId) {
      return score?.attempt_id === attemptId ? score : null;
    },
    async createScore(insert: ScoreInsert) {
      score = {
        ...insert,
        created_at: new Date().toISOString()
      };
      return score;
    },
    async findAiFeedbackByAttemptId(attemptId) {
      return feedback?.attempt_id === attemptId ? feedback : null;
    },
    async createAiFeedback(insert: AiFeedbackInsert) {
      feedback = {
        ...insert,
        created_at: new Date().toISOString()
      };
      return feedback;
    }
  };

  return {
    userId,
    question,
    attempt: currentAttempt,
    repository,
    getSnapshot: () => ({
      attempt: currentAttempt,
      statuses: [...statuses],
      score,
      feedback
    })
  };
}

function assertAttemptOwner(
  requestUserId: string,
  requestAttemptId: string,
  expectedUserId: string,
  expectedAttemptId: string
) {
  if (
    requestUserId !== expectedUserId ||
    requestAttemptId !== expectedAttemptId
  ) {
    throw new Error("Live smoke attempt was not found.");
  }
}
