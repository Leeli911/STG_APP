import { assertTrainingDayNumber } from "@/server/questions/dayNumber";
import type { QuestionDto, QuestionRow } from "@/server/questions/types";

export function toQuestionDto(row: QuestionRow): QuestionDto {
  assertTrainingDayNumber(row.day_number);

  return {
    id: row.id,
    dayNumber: row.day_number,
    title: row.title,
    scenario: row.scenario,
    prompt: row.prompt,
    learningGoal: row.learning_goal,
    expectedStructure: row.expected_structure,
    evaluationFocus: row.evaluation_focus,
    knowledgeCard: row.knowledge_card,
    isActive: row.is_active
  };
}
