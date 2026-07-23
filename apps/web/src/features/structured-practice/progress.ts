import type {
  SkillAssessmentStatus,
  StructuredPracticeRecord,
  StructuredSkillId
} from "@/features/structured-practice/types";

export type StructuredSkillProgressStatus =
  | "not_started"
  | "practicing"
  | "due"
  | "initially_stable";

export function scheduleDelayedPractice(
  completedAt: string,
  delayHours = 24
) {
  return new Date(
    new Date(completedAt).getTime() + delayHours * 60 * 60 * 1000
  ).toISOString();
}

export function findDuePractice(
  records: StructuredPracticeRecord[],
  now = new Date()
) {
  return records.find(
    (record) =>
      !record.delayedCompletedAt &&
      new Date(record.dueAt).getTime() <= now.getTime()
  );
}

export function completeDelayedPractice(input: {
  records: StructuredPracticeRecord[];
  recordId: string;
  promptId: string;
  status: SkillAssessmentStatus;
  completedAt?: string;
}) {
  const completedAt = input.completedAt ?? new Date().toISOString();
  return input.records.map((record) =>
    record.id === input.recordId
      ? {
          ...record,
          delayedPromptId: input.promptId,
          delayedCompletedAt: completedAt,
          delayedStatus: input.status
        }
      : record
  );
}

export function getStructuredSkillProgress(
  records: StructuredPracticeRecord[],
  skillId: StructuredSkillId,
  now = new Date()
): StructuredSkillProgressStatus {
  const matching = records.filter((record) => record.skillId === skillId);
  if (matching.length === 0) return "not_started";
  if (matching.some((record) => record.delayedStatus === "met")) {
    return "initially_stable";
  }
  if (
    matching.some(
      (record) =>
        !record.delayedCompletedAt &&
        new Date(record.dueAt).getTime() <= now.getTime()
    )
  ) {
    return "due";
  }
  return "practicing";
}
