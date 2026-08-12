import type {
  DaySevenOutcome,
  PostCourseReflection,
  ProgressiveCourseDay,
  ProgressiveCourseProgress
} from "@/features/progressive-course/types";

export const PROGRESSIVE_COURSE_KEY = "stg:v0.5:progressive-course";
export const PROGRESSIVE_SESSION_KEY = "stg:v0.5:progressive-session";
export const PROGRESSIVE_DAY_SEVEN_SESSION_KEY =
  "stg:v0.5:day-seven-session";

const courseDays: ProgressiveCourseDay[] = [1, 2, 3, 4, 5, 6, 7];
const sessionStages = [
  "lesson",
  "knowledge",
  "guided",
  "independent",
  "project_draft",
  "project_revision",
  "project_transfer",
  "complete"
] as const;

export type ProgressiveSessionStage = (typeof sessionStages)[number];

export type DaySevenSession = {
  originalAnswer: string;
  originalChecked: boolean;
  projectInitialPassed: boolean | null;
  revisionAnswer: string;
  revisionChecked: boolean;
  transferAnswer: string;
  transferChecked: boolean;
  transferFirstPassed: boolean | null;
  projectAttempts: number;
  revisionAttempts: number;
  transferAttempts: number;
};

export type ProgressiveCourseSession = {
  version: 1;
  day: ProgressiveCourseDay;
  stage: ProgressiveSessionStage;
  dayOneSelections: Record<string, string>;
  dayTwoKnowledgeSelection: string;
  dayTwoGuidedSelection: string;
  dayTwoAnswer: string;
  dayTwoChecked: boolean;
  dayThreeKnowledgeSelection: string;
  dayThreeOrder: string[];
  dayThreeAnswer: string;
  dayThreeChecked: boolean;
  dayFourKnowledgeSelection: string;
  dayFourGuidedSelection: string;
  dayFourAnswer: string;
  dayFourChecked: boolean;
  dayFiveKnowledgeSelection: string;
  dayFiveCardGroups: Record<string, string>;
  dayFiveAnswer: string;
  dayFiveChecked: boolean;
  daySixKnowledgeSelection: string;
  daySixGuidedSelections: Record<string, string>;
  daySixAnswer: string;
  daySixChecked: boolean;
  daySeven: DaySevenSession;
  scaffoldVisible: boolean;
};

export function createProgressiveCourseProgress(
  now = new Date()
): ProgressiveCourseProgress {
  return {
    version: 1,
    completedDays: [],
    lessonViewedDays: [],
    scaffoldUses: {},
    updatedAt: now.toISOString()
  };
}

export function createProgressiveCourseSession(): ProgressiveCourseSession {
  return {
    version: 1,
    day: 1,
    stage: "lesson",
    dayOneSelections: {},
    dayTwoKnowledgeSelection: "",
    dayTwoGuidedSelection: "",
    dayTwoAnswer: "",
    dayTwoChecked: false,
    dayThreeKnowledgeSelection: "",
    dayThreeOrder: ["", "", ""],
    dayThreeAnswer: "",
    dayThreeChecked: false,
    dayFourKnowledgeSelection: "",
    dayFourGuidedSelection: "",
    dayFourAnswer: "",
    dayFourChecked: false,
    dayFiveKnowledgeSelection: "",
    dayFiveCardGroups: {},
    dayFiveAnswer: "",
    dayFiveChecked: false,
    daySixKnowledgeSelection: "",
    daySixGuidedSelections: {},
    daySixAnswer: "",
    daySixChecked: false,
    daySeven: createDaySevenSession(),
    scaffoldVisible: false
  };
}

export function createDaySevenSession(): DaySevenSession {
  return {
    originalAnswer: "",
    originalChecked: false,
    projectInitialPassed: null,
    revisionAnswer: "",
    revisionChecked: false,
    transferAnswer: "",
    transferChecked: false,
    transferFirstPassed: null,
    projectAttempts: 0,
    revisionAttempts: 0,
    transferAttempts: 0
  };
}

export function parseProgressiveCourseSession(
  value: string | null
): ProgressiveCourseSession {
  const fallback = createProgressiveCourseSession();
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as Partial<ProgressiveCourseSession>;
    if (parsed.version !== 1) return fallback;
    const day = normalizeSessionDay(parsed.day);
    const stage = sessionStages.includes(
      parsed.stage as ProgressiveSessionStage
    )
      ? (parsed.stage as ProgressiveSessionStage)
      : "lesson";

    return {
      version: 1,
      day,
      stage,
      dayOneSelections: normalizeSelections(parsed.dayOneSelections),
      dayTwoKnowledgeSelection: normalizeString(
        parsed.dayTwoKnowledgeSelection
      ),
      dayTwoGuidedSelection: normalizeString(parsed.dayTwoGuidedSelection),
      dayTwoAnswer: normalizeString(parsed.dayTwoAnswer),
      dayTwoChecked: parsed.dayTwoChecked === true,
      dayThreeKnowledgeSelection: normalizeString(
        parsed.dayThreeKnowledgeSelection
      ),
      dayThreeOrder: normalizeOrder(parsed.dayThreeOrder),
      dayThreeAnswer: normalizeString(parsed.dayThreeAnswer),
      dayThreeChecked: parsed.dayThreeChecked === true,
      dayFourKnowledgeSelection: normalizeString(
        parsed.dayFourKnowledgeSelection
      ),
      dayFourGuidedSelection: normalizeString(
        parsed.dayFourGuidedSelection
      ),
      dayFourAnswer: normalizeString(parsed.dayFourAnswer),
      dayFourChecked: parsed.dayFourChecked === true,
      dayFiveKnowledgeSelection: normalizeString(
        parsed.dayFiveKnowledgeSelection
      ),
      dayFiveCardGroups: normalizeSelections(parsed.dayFiveCardGroups),
      dayFiveAnswer: normalizeString(parsed.dayFiveAnswer),
      dayFiveChecked: parsed.dayFiveChecked === true,
      daySixKnowledgeSelection: normalizeString(
        parsed.daySixKnowledgeSelection
      ),
      daySixGuidedSelections: normalizeSelections(
        parsed.daySixGuidedSelections
      ),
      daySixAnswer: normalizeLongString(parsed.daySixAnswer),
      daySixChecked: parsed.daySixChecked === true,
      daySeven: normalizeDaySevenSession(parsed.daySeven),
      scaffoldVisible: parsed.scaffoldVisible === true
    };
  } catch {
    return fallback;
  }
}

export function parseProgressiveCourseProgress(
  value: string | null,
  now = new Date()
) {
  if (!value) return createProgressiveCourseProgress(now);

  try {
    const parsed = JSON.parse(value) as Partial<ProgressiveCourseProgress>;
    if (parsed.version !== 1) return createProgressiveCourseProgress(now);

    return {
      version: 1 as const,
      completedDays: normalizeCompletedDays(parsed.completedDays),
      lessonViewedDays: normalizeDays(parsed.lessonViewedDays),
      scaffoldUses: normalizeScaffoldUses(parsed.scaffoldUses),
      daySevenOutcome: normalizeDaySevenOutcome(parsed.daySevenOutcome),
      reflection: normalizePostCourseReflection(parsed.reflection),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : now.toISOString()
    };
  } catch {
    return createProgressiveCourseProgress(now);
  }
}

export function isProgressiveDayUnlocked(
  progress: ProgressiveCourseProgress,
  day: ProgressiveCourseDay
) {
  if (day === 1) return true;
  return courseDays
    .slice(0, day - 1)
    .every((requiredDay) => progress.completedDays.includes(requiredDay));
}

export function markProgressiveLessonViewed(
  progress: ProgressiveCourseProgress,
  day: ProgressiveCourseDay,
  now = new Date()
): ProgressiveCourseProgress {
  return {
    ...progress,
    lessonViewedDays: normalizeDays([...progress.lessonViewedDays, day]),
    updatedAt: now.toISOString()
  };
}

export function recordProgressiveScaffoldUse(
  progress: ProgressiveCourseProgress,
  day: ProgressiveCourseDay,
  now = new Date()
): ProgressiveCourseProgress {
  return {
    ...progress,
    scaffoldUses: {
      ...progress.scaffoldUses,
      [day]: (progress.scaffoldUses[day] ?? 0) + 1
    },
    updatedAt: now.toISOString()
  };
}

export function completeProgressiveDay(
  progress: ProgressiveCourseProgress,
  day: ProgressiveCourseDay,
  now = new Date()
): ProgressiveCourseProgress {
  if (!isProgressiveDayUnlocked(progress, day)) return progress;
  return {
    ...progress,
    completedDays: normalizeDays([...progress.completedDays, day]),
    updatedAt: now.toISOString()
  };
}

export function completeDaySevenProject(
  progress: ProgressiveCourseProgress,
  outcome: DaySevenOutcome,
  now = new Date()
): ProgressiveCourseProgress {
  if (!isProgressiveDayUnlocked(progress, 7)) return progress;
  return {
    ...progress,
    completedDays: normalizeCompletedDays([...progress.completedDays, 7]),
    daySevenOutcome: outcome,
    updatedAt: now.toISOString()
  };
}

export function savePostCourseReflection(
  progress: ProgressiveCourseProgress,
  reflection: Omit<PostCourseReflection, "completedAt">,
  now = new Date()
): ProgressiveCourseProgress {
  if (!progress.daySevenOutcome || !progress.completedDays.includes(7)) {
    return progress;
  }
  return {
    ...progress,
    reflection: {
      ...reflection,
      completedAt: now.toISOString()
    },
    updatedAt: now.toISOString()
  };
}

function normalizeCompletedDays(value: unknown) {
  const normalized = normalizeDays(value);
  const prefix: ProgressiveCourseDay[] = [];
  for (const day of courseDays) {
    if (!normalized.includes(day)) break;
    prefix.push(day);
  }
  return prefix;
}

function normalizeDays(value: unknown): ProgressiveCourseDay[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (day): day is ProgressiveCourseDay =>
          typeof day === "number" &&
          courseDays.includes(day as ProgressiveCourseDay)
      )
    )
  ].sort((left, right) => left - right);
}

function normalizeScaffoldUses(value: unknown) {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      ([day, count]) =>
        courseDays.includes(Number(day) as ProgressiveCourseDay) &&
        typeof count === "number" &&
        Number.isFinite(count) &&
        count >= 0
    )
  ) as Partial<Record<ProgressiveCourseDay, number>>;
}

function normalizeSelections(value: unknown) {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, selection]) =>
        key.length <= 80 &&
        typeof selection === "string" &&
        selection.length <= 80
    )
  );
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 300) : "";
}

function normalizeLongString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 420) : "";
}

function normalizeDaySevenSession(value: unknown): DaySevenSession {
  const fallback = createDaySevenSession();
  if (!value || typeof value !== "object") return fallback;
  const parsed = value as Partial<DaySevenSession>;
  return {
    originalAnswer: normalizeProjectString(parsed.originalAnswer),
    originalChecked: parsed.originalChecked === true,
    projectInitialPassed:
      typeof parsed.projectInitialPassed === "boolean"
        ? parsed.projectInitialPassed
        : null,
    revisionAnswer: normalizeProjectString(parsed.revisionAnswer),
    revisionChecked: parsed.revisionChecked === true,
    transferAnswer: normalizeProjectString(parsed.transferAnswer),
    transferChecked: parsed.transferChecked === true,
    transferFirstPassed:
      typeof parsed.transferFirstPassed === "boolean"
        ? parsed.transferFirstPassed
        : null,
    projectAttempts: normalizeAttemptCount(parsed.projectAttempts),
    revisionAttempts: normalizeAttemptCount(parsed.revisionAttempts),
    transferAttempts: normalizeAttemptCount(parsed.transferAttempts)
  };
}

function normalizeDaySevenOutcome(value: unknown): DaySevenOutcome | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed = value as Partial<DaySevenOutcome>;
  if (
    (parsed.ruleVersion !== "stg-day-seven-rules-v1" &&
      parsed.ruleVersion !== "stg-day-seven-rules-v2") ||
    typeof parsed.projectInitialPassed !== "boolean" ||
    (parsed.revisionKind !== "improved" &&
      parsed.revisionKind !== "maintained" &&
      parsed.revisionKind !== "not_needed") ||
    typeof parsed.transferFirstPassed !== "boolean" ||
    typeof parsed.transferFinalPassed !== "boolean" ||
    typeof parsed.completedAt !== "string"
  ) {
    return undefined;
  }
  return {
    ruleVersion: parsed.ruleVersion,
    projectInitialPassed: parsed.projectInitialPassed,
    revisionKind: parsed.revisionKind,
    transferFirstPassed: parsed.transferFirstPassed,
    transferFinalPassed: parsed.transferFinalPassed,
    revisionAttempts: normalizeAttemptCount(parsed.revisionAttempts),
    transferAttempts: normalizeAttemptCount(parsed.transferAttempts),
    completedAt: parsed.completedAt
  };
}

function normalizePostCourseReflection(
  value: unknown
): PostCourseReflection | undefined {
  if (!value || typeof value !== "object") return undefined;
  const parsed = value as Partial<PostCourseReflection>;
  const challenges = [
    "purpose",
    "conclusion",
    "evidence",
    "grouping",
    "complete_report",
    "none"
  ] as const;
  const confidences = ["independent", "with_scaffold", "not_yet"] as const;
  const useCases = [
    "manager_update",
    "cross_team",
    "interview",
    "presentation_writing"
  ] as const;
  if (
    !challenges.includes(parsed.challenge as (typeof challenges)[number]) ||
    !confidences.includes(parsed.confidence as (typeof confidences)[number]) ||
    !useCases.includes(parsed.useCase as (typeof useCases)[number]) ||
    typeof parsed.completedAt !== "string"
  ) {
    return undefined;
  }
  return parsed as PostCourseReflection;
}

function normalizeProjectString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 600) : "";
}

function normalizeAttemptCount(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? Math.min(value, 99)
    : 0;
}

function normalizeSessionDay(
  value: unknown
): ProgressiveCourseSession["day"] {
  return value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6 ||
    value === 7
    ? value
    : 1;
}

function normalizeOrder(value: unknown) {
  if (!Array.isArray(value)) return ["", "", ""];
  return [0, 1, 2].map((index) => normalizeString(value[index]).slice(0, 40));
}
