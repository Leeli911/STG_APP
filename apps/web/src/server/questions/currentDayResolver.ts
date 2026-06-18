import { clampTrainingDayNumber } from "@/server/questions/dayNumber";
import type { GrowthProfileRow, TrainingDayNumber } from "@/server/questions/types";

export function resolveCurrentTrainingDay({
  growthProfile,
  completedAttemptDayNumbers
}: {
  growthProfile: GrowthProfileRow | null;
  completedAttemptDayNumbers: number[];
}): TrainingDayNumber {
  if (growthProfile) {
    return clampTrainingDayNumber(growthProfile.current_day);
  }

  const latestCompletedDay = completedAttemptDayNumbers
    .filter((dayNumber) => Number.isInteger(dayNumber))
    .reduce((latest, dayNumber) => Math.max(latest, dayNumber), 0);

  return clampTrainingDayNumber(latestCompletedDay + 1);
}
