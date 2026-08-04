import type {
  ProgressiveCourseDay,
  ProgressiveCourseProgress
} from "@/features/progressive-course/types";

export const PROGRESSIVE_COURSE_KEY = "stg:v0.5:progressive-course";
export const PROGRESSIVE_SESSION_KEY = "stg:v0.5:progressive-session";

const courseDays: ProgressiveCourseDay[] = [1, 2, 3, 4, 5, 6, 7];
const sessionStages = [
  "lesson",
  "knowledge",
  "guided",
  "independent",
  "complete"
] as const;

export type ProgressiveSessionStage = (typeof sessionStages)[number];

export type ProgressiveCourseSession = {
  version: 1;
  day: 1 | 2 | 3 | 4 | 5 | 6;
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
    scaffoldVisible: false
  };
}

export function parseProgressiveCourseSession(
  value: string | null
): ProgressiveCourseSession {
  const fallback = createProgressiveCourseSession();
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as Partial<ProgressiveCourseSession>;
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
      completedDays: normalizeDays(parsed.completedDays),
      lessonViewedDays: normalizeDays(parsed.lessonViewedDays),
      scaffoldUses: normalizeScaffoldUses(parsed.scaffoldUses),
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
  return progress.completedDays.includes((day - 1) as ProgressiveCourseDay);
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
  return {
    ...progress,
    completedDays: normalizeDays([...progress.completedDays, day]),
    updatedAt: now.toISOString()
  };
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

function normalizeSessionDay(
  value: unknown
): ProgressiveCourseSession["day"] {
  return value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6
    ? value
    : 1;
}

function normalizeOrder(value: unknown) {
  if (!Array.isArray(value)) return ["", "", ""];
  return [0, 1, 2].map((index) => normalizeString(value[index]).slice(0, 40));
}
