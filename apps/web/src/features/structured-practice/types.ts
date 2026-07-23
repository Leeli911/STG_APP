export type StructuredSkillId =
  | "purpose"
  | "conclusion_first"
  | "grouping";

export type SkillAssessmentStatus =
  | "met"
  | "partial"
  | "needs_work"
  | "uncertain";

export type SelfCheckStatus =
  | "aligned"
  | "partial"
  | "misaligned"
  | "uncertain";

export type StructuredPromptKind =
  | "cold"
  | "near_transfer"
  | "far_transfer"
  | "delayed";

export type EvaluationConcept = {
  id: string;
  label: string;
  terms: string[];
};

export type StructuredEvaluationAnchor = {
  intentConcepts: EvaluationConcept[];
  requiredIntentMatches: number;
  conclusionConcepts: EvaluationConcept[];
  requiredConclusionMatches: number;
  positionConceptIds?: string[];
  groupingConcepts?: EvaluationConcept[];
  minimumDistinctGroups?: number;
};

export type StructuredPracticePrompt = {
  id: string;
  kind: StructuredPromptKind;
  audience: string;
  desiredOutcome: string;
  prompt: string;
  evaluation: StructuredEvaluationAnchor;
};

export type StructuredPracticeScenario = {
  id: string;
  day: 1 | 2 | 3;
  skillId: StructuredSkillId;
  title: string;
  shortDescription: string;
  prompts: StructuredPracticePrompt[];
  lesson: {
    principle: string;
    checklist: string[];
  };
};

export type SkillAssessment = {
  skillId: StructuredSkillId;
  status: SkillAssessmentStatus;
  statusLabel: string;
  taskStatus: SkillAssessmentStatus;
  taskStatusLabel: string;
  selfCheckStatus: SelfCheckStatus;
  selfCheckLabel: string;
  evidence: string;
  evidenceSpan: {
    start: number;
    end: number;
  } | null;
  observation: string;
  impact: string;
  action: string;
  closestSentenceIndex: number | null;
  targetSentenceIndex: number | null;
  similarity: number | null;
  groupCount: number | null;
  distinctGroupCount: number | null;
  matchedIntentIds: string[];
  ruleVersion: "stg-structure-rules-v2";
};

export type StructuredPracticeRecord = {
  version: 2;
  id: string;
  completedAt: string;
  dueAt: string;
  scenarioId: string;
  coldPromptId: string;
  transferPromptId: string;
  skillId: StructuredSkillId;
  sessionCompleted: true;
  skillMet: boolean;
  draftStatus: SkillAssessmentStatus;
  revisionStatus: SkillAssessmentStatus;
  transferStatus: SkillAssessmentStatus;
  delayedPromptId?: string;
  delayedCompletedAt?: string;
  delayedStatus?: SkillAssessmentStatus;
};
