import { randomUUID } from "node:crypto";

import { staticQuestionRows } from "@/server/questions/staticQuestions";
import type {
  AiFeedbackInsert,
  AiFeedbackRow,
  AttemptInsert,
  AttemptQuestionRow,
  AttemptRepository,
  AttemptRow,
  ScoreInsert,
  ScoreRow
} from "@/server/attempts/types";

type DevAttemptStore = {
  attemptsByUserAndKey: Map<string, AttemptRow>;
  attemptsById: Map<string, AttemptRow>;
  scoresByAttemptId: Map<string, ScoreRow>;
  feedbackByAttemptId: Map<string, AiFeedbackRow>;
};

const devAttemptStore = getDevAttemptStore();

export function createDevAttemptRepository(): AttemptRepository {
  return {
    async findActiveQuestionById(questionId) {
      const question = staticQuestionRows.find((item) => item.id === questionId);

      if (!question) {
        return null;
      }

      return {
        id: question.id,
        day_number: question.day_number,
        is_active: question.is_active,
        title: question.title,
        scenario: question.scenario,
        prompt: question.prompt,
        learning_goal: question.learning_goal,
        expected_structure: question.expected_structure,
        evaluation_focus: question.evaluation_focus
      } satisfies AttemptQuestionRow;
    },

    async findAttemptByIdempotencyKey(userId, idempotencyKey) {
      return (
        devAttemptStore.attemptsByUserAndKey.get(
          toAttemptKey(userId, idempotencyKey)
        ) ?? null
      );
    },

    async createAttempt(insert: AttemptInsert) {
      const question = staticQuestionRows.find(
        (item) => item.id === insert.questionId
      );

      if (!question) {
        throw new Error("Question was not found.");
      }

      const row: AttemptRow = {
        id: randomUUID(),
        user_id: insert.userId,
        question_id: insert.questionId,
        day_number: question.day_number,
        original_answer: insert.answerText,
        status: "submitted",
        idempotency_key: insert.idempotencyKey,
        client_started_at: insert.clientStartedAt ?? null,
        created_at: new Date().toISOString()
      };

      devAttemptStore.attemptsByUserAndKey.set(
        toAttemptKey(insert.userId, insert.idempotencyKey),
        row
      );
      devAttemptStore.attemptsById.set(row.id, row);

      return row;
    },

    async updateAttemptStatus(userId, attemptId, status) {
      const row = devAttemptStore.attemptsById.get(attemptId);

      if (!row || row.user_id !== userId) {
        throw new Error("Attempt was not found.");
      }

      const updated: AttemptRow = {
        ...row,
        status
      };

      devAttemptStore.attemptsById.set(updated.id, updated);
      devAttemptStore.attemptsByUserAndKey.set(
        toAttemptKey(updated.user_id, updated.idempotency_key),
        updated
      );

      return updated;
    },

    async updateAttemptPipelineMetadata(userId, attemptId, metadata) {
      const row = devAttemptStore.attemptsById.get(attemptId);

      if (!row || row.user_id !== userId) {
        throw new Error("Attempt was not found.");
      }

      const updated: AttemptRow = {
        ...row,
        ...metadata
      };

      devAttemptStore.attemptsById.set(updated.id, updated);
      devAttemptStore.attemptsByUserAndKey.set(
        toAttemptKey(updated.user_id, updated.idempotency_key),
        updated
      );

      return updated;
    },

    async findAttemptById(userId, attemptId) {
      const row = devAttemptStore.attemptsById.get(attemptId);
      return row && row.user_id === userId ? row : null;
    },

    async findScoreByAttemptId(attemptId) {
      return devAttemptStore.scoresByAttemptId.get(attemptId) ?? null;
    },

    async createScore(score: ScoreInsert) {
      const row: ScoreRow = {
        ...score,
        created_at: new Date().toISOString()
      };

      devAttemptStore.scoresByAttemptId.set(score.attempt_id, row);
      return row;
    },

    async findAiFeedbackByAttemptId(attemptId) {
      return devAttemptStore.feedbackByAttemptId.get(attemptId) ?? null;
    },

    async createAiFeedback(feedback: AiFeedbackInsert) {
      const row: AiFeedbackRow = {
        ...feedback,
        created_at: new Date().toISOString()
      };

      devAttemptStore.feedbackByAttemptId.set(feedback.attempt_id, row);
      return row;
    }
  };
}

function getDevAttemptStore(): DevAttemptStore {
  const globalStore = globalThis as typeof globalThis & {
    __stgDevAttemptStore?: DevAttemptStore;
  };

  globalStore.__stgDevAttemptStore ??= {
    attemptsByUserAndKey: new Map<string, AttemptRow>(),
    attemptsById: new Map<string, AttemptRow>(),
    scoresByAttemptId: new Map<string, ScoreRow>(),
    feedbackByAttemptId: new Map<string, AiFeedbackRow>()
  };

  return globalStore.__stgDevAttemptStore;
}

function toAttemptKey(userId: string, idempotencyKey: string) {
  return `${userId}:${idempotencyKey}`;
}
