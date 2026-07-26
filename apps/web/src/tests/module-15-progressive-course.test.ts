import {
  getProgressiveLesson,
  progressiveCourse
} from "@/features/progressive-course/curriculum";
import {
  completeProgressiveDay,
  createProgressiveCourseProgress,
  createProgressiveCourseSession,
  isProgressiveDayUnlocked,
  markProgressiveLessonViewed,
  parseProgressiveCourseProgress,
  parseProgressiveCourseSession,
  recordProgressiveScaffoldUse
} from "@/features/progressive-course/progress";

describe("Module 15 progressive course contract", () => {
  it("defines one ordered difficulty step for each of seven days", () => {
    expect(progressiveCourse).toHaveLength(7);
    expect(progressiveCourse.map((lesson) => lesson.day)).toEqual([
      1, 2, 3, 4, 5, 6, 7
    ]);
    expect(progressiveCourse.map((lesson) => lesson.difficulty)).toEqual([
      1, 2, 3, 4, 5, 6, 7
    ]);
    expect(
      progressiveCourse.filter((lesson) => lesson.implemented).map((lesson) => lesson.day)
    ).toEqual([1, 2]);
  });

  it("keeps recognition separate from authoritative skill evidence", () => {
    const dayOne = getProgressiveLesson(1);
    const dayTwo = getProgressiveLesson(2);

    expect(
      dayOne.exercises.every((exercise) => !exercise.countsForSkillStatus)
    ).toBe(true);
    expect(
      dayTwo.exercises.find(
        (exercise) => exercise.kind === "independent_write"
      )?.countsForSkillStatus
    ).toBe(true);
  });

  it("unlocks days in sequence and records completion without duplicates", () => {
    const initial = createProgressiveCourseProgress(
      new Date("2026-07-26T00:00:00.000Z")
    );

    expect(isProgressiveDayUnlocked(initial, 1)).toBe(true);
    expect(isProgressiveDayUnlocked(initial, 2)).toBe(false);

    const completed = completeProgressiveDay(
      completeProgressiveDay(initial, 1),
      1
    );
    expect(completed.completedDays).toEqual([1]);
    expect(isProgressiveDayUnlocked(completed, 2)).toBe(true);
  });

  it("records viewed lessons and scaffold use as support data, not scores", () => {
    const initial = createProgressiveCourseProgress();
    const viewed = markProgressiveLessonViewed(initial, 2);
    const supported = recordProgressiveScaffoldUse(
      recordProgressiveScaffoldUse(viewed, 2),
      2
    );

    expect(supported.lessonViewedDays).toEqual([2]);
    expect(supported.scaffoldUses[2]).toBe(2);
    expect(supported.completedDays).toEqual([]);
  });

  it("fails closed when stored progress or sessions are malformed", () => {
    expect(parseProgressiveCourseProgress("{broken")).toMatchObject({
      version: 1,
      completedDays: [],
      lessonViewedDays: []
    });
    expect(
      parseProgressiveCourseProgress(
        JSON.stringify({
          version: 1,
          completedDays: [1, 1, 99, "2"],
          lessonViewedDays: [1, 3]
        })
      ).completedDays
    ).toEqual([1]);

    expect(parseProgressiveCourseSession("{broken")).toEqual(
      createProgressiveCourseSession()
    );
    expect(
      parseProgressiveCourseSession(
        JSON.stringify({
          version: 1,
          day: 9,
          stage: "hacked",
          dayTwoAnswer: "保留安全范围内的文本"
        })
      )
    ).toMatchObject({
      day: 1,
      stage: "lesson",
      dayTwoAnswer: "保留安全范围内的文本"
    });
  });
});
