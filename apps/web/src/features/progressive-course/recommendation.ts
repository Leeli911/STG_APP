import type {
  DaySevenOutcome,
  PostCourseReflection,
  ProgressiveCourseDay,
  ReflectionChallenge,
  ReflectionUseCase
} from "@/features/progressive-course/types";

export type NextPracticeRecommendation = {
  day: Exclude<ProgressiveCourseDay, 1 | 7>;
  title: string;
  reason: string;
  action: string;
  useCaseLabel: string;
};

const challengeDay: Record<
  ReflectionChallenge,
  Exclude<ProgressiveCourseDay, 1 | 7>
> = {
  purpose: 2,
  conclusion: 3,
  evidence: 4,
  grouping: 5,
  complete_report: 6,
  none: 6
};

const dayTitles: Record<Exclude<ProgressiveCourseDay, 1 | 7>, string> = {
  2: "明确目的",
  3: "结论先行",
  4: "用理由支撑结论",
  5: "整理两到三个要点",
  6: "完成一次完整汇报"
};

const useCaseLabels: Record<ReflectionUseCase, string> = {
  manager_update: "向主管汇报",
  cross_team: "跨团队沟通",
  interview: "求职面试",
  presentation_writing: "演讲或写作"
};

export function getNextPracticeRecommendation({
  outcome,
  reflection
}: {
  outcome: DaySevenOutcome;
  reflection: PostCourseReflection;
}): NextPracticeRecommendation {
  const day = challengeDay[reflection.challenge];
  const useCaseLabel = useCaseLabels[reflection.useCase];
  const reason = getReason(outcome, reflection);
  const action =
    reflection.confidence === "independent"
      ? `先重练 Day ${day}，再把同一结构用到一次${useCaseLabel}。`
      : reflection.confidence === "with_scaffold"
        ? `先带支架重练 Day ${day}，通过后再关闭支架完成一次。`
        : `先从 Day ${day} 的讲解和选择题重新开始，不要求直接写长回答。`;

  return {
    day,
    title: dayTitles[day],
    reason,
    action,
    useCaseLabel
  };
}

function getReason(
  outcome: DaySevenOutcome,
  reflection: PostCourseReflection
) {
  if (!outcome.transferFinalPassed) {
    return "本次未见迁移仍待加强；先修复你自评最困难的结构动作，再回来补做迁移。";
  }
  if (reflection.challenge !== "none") {
    return "你已完成即时迁移，但自评仍有明确卡点；下一次只练这一项，避免同时改太多。";
  }
  if (!outcome.projectInitialPassed) {
    return "毕业项目首稿曾出现结构缺口；用更短的一次复练巩固从首稿到完整表达的过程。";
  }
  return "首稿和即时迁移均达到当前规则；下一步用完整汇报复练保持训练强度。";
}
