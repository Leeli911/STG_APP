import {
  completeDelayedPractice,
  findDuePractice,
  getStructuredSkillProgress,
  scheduleDelayedPractice
} from "@/features/structured-practice/progress";
import type {
  StructuredPracticeRecord,
  StructuredSkillId
} from "@/features/structured-practice/types";

const completedAt = "2026-07-24T02:30:00.000Z";
const dueAt = "2026-07-25T02:30:00.000Z";

function makeRecord(
  id: string,
  skillId: StructuredSkillId,
  overrides: Partial<StructuredPracticeRecord> = {}
): StructuredPracticeRecord {
  return {
    version: 2,
    id,
    completedAt,
    dueAt,
    scenarioId: `scenario-${skillId}`,
    coldPromptId: `cold-${skillId}`,
    transferPromptId: `transfer-${skillId}`,
    skillId,
    sessionCompleted: true,
    skillMet: false,
    draftStatus: "needs_work",
    revisionStatus: "partial",
    transferStatus: "partial",
    ...overrides
  };
}

describe("Module 16 structured practice delayed progress", () => {
  it("schedules the delayed cold test exactly 24 hours after completion", () => {
    expect(scheduleDelayedPractice(completedAt)).toBe(dueAt);
  });

  it("does not return a practice before it is due and returns it after the deadline", () => {
    const record = makeRecord("purpose-1", "purpose");

    expect(
      findDuePractice([record], new Date("2026-07-25T02:29:59.999Z"))
    ).toBeUndefined();
    expect(
      findDuePractice([record], new Date("2026-07-25T02:30:00.001Z"))
    ).toBe(record);
  });

  it("completes only the requested record and preserves every original record", () => {
    const target = Object.freeze(makeRecord("purpose-1", "purpose"));
    const other = Object.freeze(makeRecord("grouping-1", "grouping"));
    const originalRecords = Object.freeze([target, other]);
    const delayedCompletedAt = "2026-07-25T03:00:00.000Z";

    const updated = completeDelayedPractice({
      records: originalRecords as StructuredPracticeRecord[],
      recordId: target.id,
      promptId: "delayed-purpose-1",
      status: "met",
      completedAt: delayedCompletedAt
    });

    expect(updated).not.toBe(originalRecords);
    expect(updated[0]).not.toBe(target);
    expect(updated[0]).toEqual({
      ...target,
      delayedPromptId: "delayed-purpose-1",
      delayedCompletedAt,
      delayedStatus: "met"
    });
    expect(updated[1]).toBe(other);
    expect(target).not.toHaveProperty("delayedCompletedAt");
    expect(other).not.toHaveProperty("delayedCompletedAt");
  });

  it("reports not_started, practicing, due, and initially_stable distinctly", () => {
    const beforeDue = new Date("2026-07-25T02:29:59.999Z");
    const afterDue = new Date("2026-07-25T02:30:00.001Z");
    const pending = makeRecord("purpose-1", "purpose");
    const stable = makeRecord("conclusion-1", "conclusion_first", {
      delayedPromptId: "delayed-conclusion-1",
      delayedCompletedAt: "2026-07-25T03:00:00.000Z",
      delayedStatus: "met"
    });

    expect(getStructuredSkillProgress([], "grouping", beforeDue)).toBe(
      "not_started"
    );
    expect(getStructuredSkillProgress([pending], "purpose", beforeDue)).toBe(
      "practicing"
    );
    expect(getStructuredSkillProgress([pending], "purpose", afterDue)).toBe(
      "due"
    );
    expect(
      getStructuredSkillProgress([pending, stable], "conclusion_first", afterDue)
    ).toBe("initially_stable");
  });

  it("keeps a completed non-passing delayed test in practicing state", () => {
    const record = makeRecord("grouping-1", "grouping", {
      delayedPromptId: "delayed-grouping-1",
      delayedCompletedAt: "2026-07-25T03:00:00.000Z",
      delayedStatus: "partial"
    });

    expect(
      getStructuredSkillProgress(
        [record],
        "grouping",
        new Date("2026-07-26T00:00:00.000Z")
      )
    ).toBe("practicing");
    expect(findDuePractice([record], new Date("2026-07-26T00:00:00.000Z"))).toBe(
      undefined
    );
  });
});
