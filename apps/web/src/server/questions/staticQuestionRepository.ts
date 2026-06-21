import { staticQuestionRows } from "@/server/questions/staticQuestions";
import type {
  QuestionRepository,
  TrainingDayNumber
} from "@/server/questions/types";

export function createStaticQuestionRepository(): QuestionRepository {
  return {
    async listActiveQuestions() {
      return staticQuestionRows.filter((question) => question.is_active);
    },

    async findActiveQuestionByDay(dayNumber: TrainingDayNumber) {
      return (
        staticQuestionRows.find(
          (question) =>
            question.day_number === dayNumber && question.is_active
        ) ?? null
      );
    },

    async findGrowthProfile() {
      return null;
    },

    async listCompletedAttemptDayNumbers() {
      return [];
    }
  };
}
