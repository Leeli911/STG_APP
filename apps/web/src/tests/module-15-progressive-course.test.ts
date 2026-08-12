import {
  getProgressiveLesson,
  progressiveCourse
} from "@/features/progressive-course/curriculum";
import {
  completeDaySevenProject,
  completeProgressiveDay,
  createProgressiveCourseProgress,
  createProgressiveCourseSession,
  isProgressiveDayUnlocked,
  markProgressiveLessonViewed,
  parseProgressiveCourseProgress,
  parseProgressiveCourseSession,
  recordProgressiveScaffoldUse,
  savePostCourseReflection
} from "@/features/progressive-course/progress";
import {
  DAY_SEVEN_RULE_VERSION,
  evaluateDaySevenReport,
  evaluateDaySevenRevision
} from "@/features/progressive-course/projectEvaluator";
import { evaluateDaySixReport } from "@/features/progressive-course/reportEvaluator";
import { getNextPracticeRecommendation } from "@/features/progressive-course/recommendation";
import { evaluateDayFourAnswer } from "@/features/progressive-course/supportEvaluator";
import type { ProgressiveCourseProgress } from "@/features/progressive-course/types";
import { getStructuredPracticePrompt } from "@/features/structured-practice/curriculum";
import { evaluateStructuredAnswer } from "@/features/structured-practice/ruleEngine";

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
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps recognition separate from authoritative skill evidence", () => {
    const dayOne = getProgressiveLesson(1);
    const dayTwo = getProgressiveLesson(2);
    const dayThree = getProgressiveLesson(3);
    const dayFour = getProgressiveLesson(4);
    const dayFive = getProgressiveLesson(5);
    const daySix = getProgressiveLesson(6);
    const daySeven = getProgressiveLesson(7);

    expect(
      dayOne.exercises.every((exercise) => !exercise.countsForSkillStatus)
    ).toBe(true);
    expect(
      dayTwo.exercises.find(
        (exercise) => exercise.kind === "independent_write"
      )?.countsForSkillStatus
    ).toBe(true);
    expect(
      dayThree.exercises.find((exercise) => exercise.kind === "reorder")
        ?.countsForSkillStatus
    ).toBe(false);
    expect(
      dayThree.exercises.find(
        (exercise) => exercise.kind === "independent_write"
      )?.countsForSkillStatus
    ).toBe(true);
    expect(
      dayFour.exercises.find(
        (exercise) => exercise.kind === "guided_write"
      )?.countsForSkillStatus
    ).toBe(false);
    expect(
      dayFour.exercises.find(
        (exercise) => exercise.kind === "independent_write"
      )?.countsForSkillStatus
    ).toBe(true);
    expect(
      dayFive.exercises.find((exercise) => exercise.id === "day-5-group-cards")
        ?.countsForSkillStatus
    ).toBe(false);
    expect(
      dayFive.exercises.find(
        (exercise) => exercise.kind === "independent_write"
      )?.countsForSkillStatus
    ).toBe(true);
    expect(
      daySix.exercises.find((exercise) => exercise.kind === "guided_write")
        ?.countsForSkillStatus
    ).toBe(false);
    expect(
      daySix.exercises.find(
        (exercise) => exercise.kind === "independent_write"
      )?.countsForSkillStatus
    ).toBe(true);
    expect(daySeven.knowledgeChecks).toEqual([]);
    expect(daySeven.exercises).toEqual([
      expect.objectContaining({
        kind: "final_project",
        scaffoldLevel: "none",
        countsForSkillStatus: true
      }),
      expect.objectContaining({
        kind: "transfer",
        scaffoldLevel: "none",
        countsForSkillStatus: true
      })
    ]);
  });

  it("evaluates the Day 7 project and transfer against separate frozen facts", () => {
    const project =
      "建议将客服工单系统切换推迟到下周一。第一，历史工单目前只迁移了60%。第二，试运行中有8%的附件缺失。第三，供应商预计两天可修复，旧系统合同持续到月底。请运营总监今天批准将系统切换推迟到下周一。";
    const transfer =
      "建议把剩余预算集中投放到渠道A。第一，渠道A获客成本82元、转化率7.8%，效率更高。第二，渠道B获客成本146元、转化率3.1%。第三，剩余预算只够一个渠道，且渠道A素材已审核。请市场负责人今天批准把剩余预算集中到渠道A。";

    expect(evaluateDaySevenReport(project, "project")).toMatchObject({
      status: "met",
      passed: true
    });
    expect(evaluateDaySevenReport(transfer, "transfer")).toMatchObject({
      status: "met",
      passed: true
    });
    expect(evaluateDaySevenReport(project, "transfer")).toMatchObject({
      status: "off_task",
      passed: false
    });
    expect(
      evaluateDaySevenReport(
        project.replace("60%", "72%"),
        "project"
      )
    ).toMatchObject({ status: "unsupported_fact", passed: false });
  });

  it("accepts natural Chinese point markers and full-width percentages", () => {
    expect(
      evaluateDaySevenReport(
        "建议将客服工单系统切换推迟到下周一。数据准备方面，历史工单目前只迁移了60％。运行风险方面，试运行中有8％的附件缺失。请运营总监今天批准将系统切换推迟到下周一。",
        "project"
      )
    ).toMatchObject({ status: "met", passed: true });

    expect(
      evaluateDaySevenReport(
        "建议把剩余预算集中投放到渠道A。首先，渠道A获客成本82元、转化率7.8%。其次，剩余预算只够支持一个渠道。请市场负责人今天批准把剩余预算集中投放到渠道A。",
        "transfer"
      )
    ).toMatchObject({ status: "met", passed: true });
  });

  it("rejects evidence that repeats fact keywords while reversing their direction", () => {
    expect(
      evaluateDaySevenReport(
        "建议将客服工单系统切换推迟到下周一。第一，历史工单已经全部迁移完成。第二，试运行附件完全没有缺失。请运营总监今天批准将系统切换推迟到下周一。",
        "project"
      )
    ).toMatchObject({ status: "weak_evidence", passed: false });
  });

  it("requires a substantive Day 7 revision that remains structurally complete", () => {
    const before =
      "建议将客服工单系统切换推迟到下周一。第一，历史工单目前只迁移了60%。第二，试运行中有8%的附件缺失。第三，供应商预计两天可修复，旧系统合同持续到月底。以上是当前情况。";
    const after =
      "建议将客服工单系统切换推迟到下周一。第一，历史工单目前只迁移了60%。第二，试运行中有8%的附件缺失。第三，供应商预计两天可修复，旧系统合同持续到月底。请运营总监今天批准将系统切换推迟到下周一。";
    const beforeAssessment = evaluateDaySevenReport(before, "project");
    const afterAssessment = evaluateDaySevenReport(after, "project");

    expect(
      evaluateDaySevenRevision({
        before,
        after: `${before}  `,
        beforeAssessment,
        afterAssessment: beforeAssessment
      })
    ).toMatchObject({ status: "unchanged", passed: false });
    expect(
      evaluateDaySevenRevision({
        before,
        after,
        beforeAssessment,
        afterAssessment
      })
    ).toMatchObject({ status: "improved", passed: true });
  });

  it("only passes Day 6 when conclusion, distinct evidence, and request all exist", () => {
    expect(
      evaluateDaySixReport(
        "建议将本周五发布推迟到下周一。第一，两个关键接口仍未通过联调。第二，最近三次测试有两次出现数据同步失败。第三，客户培训已经调整到下周一。请负责人今天批准将发布推迟到下周一。"
      )
    ).toMatchObject({
      status: "met",
      passed: true,
      checks: [
        { id: "conclusion", passed: true },
        { id: "points", passed: true },
        { id: "evidence", passed: true },
        { id: "request", passed: true }
      ]
    });

    expect(
      evaluateDaySixReport(
        "建议将本周五发布推迟到下周一。第一，两个关键接口仍未通过联调。第二，最近三次测试有两次出现数据同步失败。第三，客户培训已经调整到下周一。以上是当前情况。"
      )
    ).toMatchObject({
      status: "missing_request",
      passed: false
    });
  });

  it("rejects Day 6 reports that repeat evidence or explain scoring rules", () => {
    expect(
      evaluateDaySixReport(
        "建议将本周五发布推迟到下周一。第一，两个关键接口仍未通过联调。第二，接口联调仍有问题。第三，联调问题影响发布。请负责人今天批准将发布推迟到下周一。"
      )
    ).toMatchObject({
      status: "weak_evidence",
      passed: false
    });

    expect(
      evaluateDaySixReport(
        "为了通过评分标准，我先命中规则。第一，写结论关键词。第二，写分点关键词。第三，写请求关键词。请负责人今天批准将发布推迟到下周一。"
      )
    ).toMatchObject({
      status: "off_task",
      passed: false
    });
  });

  it("only passes Day 5 when the answer contains distinct explicit groups", () => {
    const prompt = getStructuredPracticePrompt("stg-v04-grouping-cold-01");
    const evaluate = (answer: string) =>
      evaluateStructuredAnswer({
        skillId: "grouping",
        answer,
        selfStatement: answer,
        evaluation: prompt.evaluation
      });

    expect(
      evaluate(
        "建议下一阶段优先优化新用户引导。第一，流失集中在前三步；第二，相关客服咨询很多；第三，改动成本相对较低。"
      )
    ).toMatchObject({ status: "met" });
    expect(
      evaluate(
        "建议下一阶段优先优化新用户引导。第一，用户流失很多；第二，前三步用户流失严重；第三，流失影响转化。"
      )
    ).not.toMatchObject({ status: "met" });
  });

  it("only passes Day 4 when a conclusion-first answer has one direct reason", () => {
    expect(
      evaluateDayFourAnswer(
        "建议更新周报提交检查清单。最近四次周报有三次漏填新增的风险字段。"
      )
    ).toMatchObject({
      status: "met",
      passed: true
    });
    expect(
      evaluateDayFourAnswer(
        "最近四次周报有三次漏填新增的风险字段。建议更新周报提交检查清单。"
      )
    ).toMatchObject({
      status: "background_first",
      passed: false
    });
  });

  it("does not treat a bare or circular Day 4 conclusion as supported", () => {
    expect(
      evaluateDayFourAnswer("建议调整周报提交流程，因为这个流程需要调整。")
    ).toMatchObject({
      status: "missing_reason",
      passed: false
    });
    expect(
      evaluateDayFourAnswer(
        "为了命中规则，我使用结论先行和关键词说明需要调整周报。"
      )
    ).toMatchObject({
      status: "missing_conclusion",
      passed: false
    });
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
    expect(
      isProgressiveDayUnlocked(
        { ...initial, completedDays: [6] },
        7
      )
    ).toBe(false);
  });

  it("records Day 7 completion and its no-answer evidence together", () => {
    const progress: ProgressiveCourseProgress = {
      ...createProgressiveCourseProgress(),
      completedDays: [1, 2, 3, 4, 5, 6]
    };
    const completed = completeDaySevenProject(progress, {
      ruleVersion: DAY_SEVEN_RULE_VERSION,
      projectInitialPassed: false,
      revisionKind: "improved",
      transferFirstPassed: false,
      transferFinalPassed: true,
      revisionAttempts: 1,
      transferAttempts: 2,
      completedAt: "2026-08-09T00:00:00.000Z"
    });

    expect(completed.completedDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(completed.daySevenOutcome).toMatchObject({
      projectInitialPassed: false,
      transferFirstPassed: false,
      transferFinalPassed: true
    });
    expect(JSON.stringify(completed)).not.toContain("客服工单系统");
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

  it("stores a choice-only reflection and derives one concrete retraining action", () => {
    const completed = completeDaySevenProject(
      {
        ...createProgressiveCourseProgress(),
        completedDays: [1, 2, 3, 4, 5, 6]
      },
      {
        ruleVersion: DAY_SEVEN_RULE_VERSION,
        projectInitialPassed: false,
        revisionKind: "improved",
        transferFirstPassed: false,
        transferFinalPassed: false,
        revisionAttempts: 1,
        transferAttempts: 1,
        completedAt: "2026-08-10T00:00:00.000Z"
      }
    );
    const reflected = savePostCourseReflection(
      completed,
      {
        challenge: "grouping",
        confidence: "with_scaffold",
        useCase: "manager_update"
      },
      new Date("2026-08-10T01:00:00.000Z")
    );

    expect(reflected.reflection).toEqual({
      challenge: "grouping",
      confidence: "with_scaffold",
      useCase: "manager_update",
      completedAt: "2026-08-10T01:00:00.000Z"
    });
    expect(
      getNextPracticeRecommendation({
        outcome: reflected.daySevenOutcome!,
        reflection: reflected.reflection!
      })
    ).toMatchObject({ day: 5, title: "整理两到三个要点" });
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

    expect(
      parseProgressiveCourseSession(
        JSON.stringify({
          version: 1,
          day: 4,
          stage: "independent",
          dayFourAnswer: "建议更新检查清单。最近三次周报都漏填风险字段。"
        })
      )
    ).toMatchObject({
      day: 4,
      stage: "independent",
      dayFourAnswer: "建议更新检查清单。最近三次周报都漏填风险字段。"
    });

    expect(
      parseProgressiveCourseSession(
        JSON.stringify({
          version: 1,
          day: 5,
          stage: "guided",
          dayFiveKnowledgeSelection: "distinct-groups",
          dayFiveCardGroups: {
            complaints: "customer-impact",
            invalid: 12
          },
          dayFiveAnswer: "建议优化新用户引导。",
          dayFiveChecked: true
        })
      )
    ).toMatchObject({
      day: 5,
      stage: "guided",
      dayFiveKnowledgeSelection: "distinct-groups",
      dayFiveCardGroups: {
        complaints: "customer-impact"
      },
      dayFiveAnswer: "建议优化新用户引导。",
      dayFiveChecked: true
    });

    expect(
      parseProgressiveCourseSession(
        JSON.stringify({
          version: 1,
          day: 6,
          stage: "independent",
          daySixKnowledgeSelection: "complete-order",
          daySixGuidedSelections: {
            conclusion: "conclusion",
            request: "request",
            invalid: 12
          },
          daySixAnswer: "建议将本周五发布推迟到下周一。",
          daySixChecked: true
        })
      )
    ).toMatchObject({
      day: 6,
      stage: "independent",
      daySixKnowledgeSelection: "complete-order",
      daySixGuidedSelections: {
        conclusion: "conclusion",
        request: "request"
      },
      daySixAnswer: "建议将本周五发布推迟到下周一。",
      daySixChecked: true
    });

    expect(
      parseProgressiveCourseSession(
        JSON.stringify({ version: 99, day: 7, stage: "complete" })
      )
    ).toEqual(createProgressiveCourseSession());
    expect(
      parseProgressiveCourseProgress(
        JSON.stringify({
          version: 1,
          completedDays: [1, 3, 6, 7],
          lessonViewedDays: []
        })
      ).completedDays
    ).toEqual([1]);
  });
});
