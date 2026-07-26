export type ProgressiveCourseDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ProgressiveExerciseKind =
  | "recognize"
  | "reorder"
  | "fill"
  | "guided_write"
  | "independent_write"
  | "transfer"
  | "final_project";

export type ScaffoldLevel = "full" | "partial" | "none";

export type ChoiceOption = {
  id: string;
  label: string;
};

export type KnowledgeCheck = {
  id: string;
  prompt: string;
  context?: string;
  options: ChoiceOption[];
  correctOptionId: string;
  successExplanation: string;
  retryExplanation: string;
};

export type ProgressiveLessonContent = {
  definition: string;
  value: string;
  formula: string;
  badExample: {
    label: string;
    text: string;
    explanation: string;
  };
  goodExample: {
    label: string;
    text: string;
    explanation: string;
  };
  commonMistake: string;
};

export type ProgressiveExercise = {
  id: string;
  kind: ProgressiveExerciseKind;
  scaffoldLevel: ScaffoldLevel;
  countsForSkillStatus: boolean;
};

export type ProgressiveCourseLesson = {
  id: string;
  day: ProgressiveCourseDay;
  difficulty: ProgressiveCourseDay;
  title: string;
  conceptGoal: string;
  estimatedMinutes: number;
  implemented: boolean;
  lesson?: ProgressiveLessonContent;
  knowledgeChecks?: KnowledgeCheck[];
  exercises: ProgressiveExercise[];
};

export type ProgressiveCourseProgress = {
  version: 1;
  completedDays: ProgressiveCourseDay[];
  lessonViewedDays: ProgressiveCourseDay[];
  scaffoldUses: Partial<Record<ProgressiveCourseDay, number>>;
  updatedAt: string;
};
