export type StructuredSkillId =
  | "purpose"
  | "conclusion_first"
  | "grouping";

export type SkillAssessmentStatus = "met" | "partial" | "needs_work";

export type StructuredPracticeScenario = {
  id: string;
  day: 1 | 2 | 3;
  skillId: StructuredSkillId;
  title: string;
  shortDescription: string;
  audience: string;
  desiredOutcome: string;
  prompt: string;
  transferAudience: string;
  transferDesiredOutcome: string;
  transferPrompt: string;
  lesson: {
    principle: string;
    checklist: string[];
  };
};

export type SkillAssessment = {
  skillId: StructuredSkillId;
  status: SkillAssessmentStatus;
  statusLabel: string;
  evidence: string;
  observation: string;
  impact: string;
  action: string;
  closestSentenceIndex: number | null;
  similarity: number | null;
  groupCount: number | null;
  ruleVersion: "stg-structure-rules-v1";
};

export type StructuredPracticeRecord = {
  id: string;
  completedAt: string;
  scenarioId: string;
  skillId: StructuredSkillId;
  draftStatus: SkillAssessmentStatus;
  revisionStatus: SkillAssessmentStatus;
  transferStatus: SkillAssessmentStatus;
};
