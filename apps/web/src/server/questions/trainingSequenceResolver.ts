import { toQuestionDto } from "@/server/questions/questionDto";
import type { QuestionDto, QuestionRow } from "@/server/questions/types";

export function resolveTrainingSequence(rows: QuestionRow[]): QuestionDto[] {
  return rows
    .filter((row) => row.is_active)
    .sort((left, right) => left.day_number - right.day_number)
    .map(toQuestionDto);
}
