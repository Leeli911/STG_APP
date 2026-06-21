import { assertTrainingDayNumber } from "@/server/questions/dayNumber";
import type { AttemptDto, AttemptRow } from "@/server/attempts/types";

export function toAttemptDto(row: AttemptRow): AttemptDto {
  assertTrainingDayNumber(row.day_number);

  return {
    id: row.id,
    questionId: row.question_id,
    dayNumber: row.day_number,
    answerText: row.original_answer,
    status: row.status,
    submittedAt: row.created_at
  };
}
