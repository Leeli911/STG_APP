import type { TrainingDayNumber } from "@/server/questions/types";

export function assertTrainingDayNumber(dayNumber: number): asserts dayNumber is TrainingDayNumber {
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 7) {
    throw new Error("day_number must be between 1 and 7");
  }
}

export function clampTrainingDayNumber(dayNumber: number): TrainingDayNumber {
  if (dayNumber < 1) {
    return 1;
  }

  if (dayNumber > 7) {
    return 7;
  }

  assertTrainingDayNumber(dayNumber);
  return dayNumber;
}
