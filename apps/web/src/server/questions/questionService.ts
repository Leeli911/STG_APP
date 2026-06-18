import { assertTrainingDayNumber } from "@/server/questions/dayNumber";
import { resolveCurrentTrainingDay } from "@/server/questions/currentDayResolver";
import { toQuestionDto } from "@/server/questions/questionDto";
import { resolveTrainingSequence } from "@/server/questions/trainingSequenceResolver";
import type {
  QuestionDto,
  QuestionRepository,
  TrainingDayNumber
} from "@/server/questions/types";

export type QuestionService = {
  listTrainingSequence: () => Promise<QuestionDto[]>;
  getQuestionByDay: (dayNumber: number) => Promise<QuestionDto>;
  resolveCurrentDay: (userId: string) => Promise<TrainingDayNumber>;
};

export function createQuestionService(
  repository: QuestionRepository
): QuestionService {
  return {
    async listTrainingSequence() {
      const questions = await repository.listActiveQuestions();
      return resolveTrainingSequence(questions);
    },

    async getQuestionByDay(dayNumber) {
      assertTrainingDayNumber(dayNumber);
      const question = await repository.findActiveQuestionByDay(dayNumber);

      if (!question) {
        throw new Error(`Question for day ${dayNumber} was not found`);
      }

      return toQuestionDto(question);
    },

    async resolveCurrentDay(userId) {
      const [growthProfile, completedAttemptDayNumbers] = await Promise.all([
        repository.findGrowthProfile(userId),
        repository.listCompletedAttemptDayNumbers(userId)
      ]);

      return resolveCurrentTrainingDay({
        growthProfile,
        completedAttemptDayNumbers
      });
    }
  };
}
