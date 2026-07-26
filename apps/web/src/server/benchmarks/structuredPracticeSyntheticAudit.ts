import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getStructuredPracticePrompt } from "@/features/structured-practice/curriculum";
import {
  evaluateRevisionChange,
  evaluateStructuredAnswer
} from "@/features/structured-practice/ruleEngine";
import type {
  SkillAssessment,
  StructuredSkillId
} from "@/features/structured-practice/types";

export const SYNTHETIC_AUDIT_VERSION = "structured-trajectories-synthetic-v1";

export type SyntheticTreatment = "stg" | "direct_ai" | "practice_only";

export type StructuredSyntheticTrajectory = {
  id: string;
  personaId: string;
  skillId: StructuredSkillId;
  treatment: SyntheticTreatment;
  coldPromptId: string;
  transferPromptId: string;
  coldAnswer: string;
  coldSelfStatement: string;
  revisionAnswer: string;
  learnerAuthoredRevision: boolean;
  transferAnswer: string;
  transferSelfStatement: string;
  behaviorNotes: string;
};

type StructuredSyntheticFixture = {
  version: string;
  personas: string[];
  trajectories: StructuredSyntheticTrajectory[];
};

export type StructuredSyntheticAuditCase = {
  id: string;
  personaId: string;
  skillId: StructuredSkillId;
  treatment: SyntheticTreatment;
  learnerAuthoredRevision: boolean;
  coldStatus: SkillAssessment["status"];
  revisionStatus: SkillAssessment["status"];
  transferStatus: SkillAssessment["status"];
  revisionChange: ReturnType<typeof evaluateRevisionChange>["kind"];
  revisionCanContinue: boolean;
  evidenceProvenancePassed: boolean;
  keywordGamerTransferPass: boolean;
  behaviorNotes: string;
};

export type StructuredSyntheticAuditGroup = {
  trajectories: number;
  coldMet: number;
  coldMetRate: number;
  revisionCanContinue: number;
  revisionCanContinueRate: number;
  learnerAuthoredRevision: number;
  learnerAuthoredRevisionRate: number;
  learnerAuthoredImprovement: number;
  learnerAuthoredImprovementRate: number;
  transferMet: number;
  transferMetRate: number;
};

export type StructuredSyntheticAuditSummary = {
  auditVersion: string;
  fixtureVersions: string[];
  totalTrajectories: number;
  personas: string[];
  treatments: SyntheticTreatment[];
  skills: StructuredSkillId[];
  evidenceProvenanceRate: number;
  keywordGamerTransferPasses: {
    count: number;
    eligibleTrajectories: number;
    rate: number;
    interpretation: string;
  };
  byTreatment: Record<SyntheticTreatment, StructuredSyntheticAuditGroup>;
  byPersona: Record<string, StructuredSyntheticAuditGroup>;
  fixtureIntegrity: {
    uniqueIds: boolean;
    balancedTreatments: boolean;
    balancedSkills: boolean;
    eachPersonaCoversEverySkillAndTreatment: boolean;
    treatmentMatchesRevisionOwnership: boolean;
    pairedColdBaselines: boolean;
    matchedTransferPrompts: boolean;
    passed: boolean;
  };
  limitations: string[];
};

export type StructuredSyntheticAuditRun = {
  summary: StructuredSyntheticAuditSummary;
  cases: StructuredSyntheticAuditCase[];
  markdown: string;
};

const treatmentOrder: SyntheticTreatment[] = [
  "stg",
  "direct_ai",
  "practice_only"
];
const skillOrder: StructuredSkillId[] = [
  "purpose",
  "conclusion_first",
  "grouping"
];

export function loadStructuredSyntheticTrajectories(
  paths = ["a", "b", "c"].map((suffix) =>
    join(
      process.cwd(),
      "src",
      "tests",
      "golden",
      `structured-trajectories-${suffix}.json`
    )
  )
) {
  const fixtures = paths.map((path) =>
    validateFixture(JSON.parse(readFileSync(path, "utf8")) as unknown)
  );
  const trajectories = fixtures.flatMap((fixture) => fixture.trajectories);
  validateCombinedTrajectories(trajectories);
  return {
    fixtureVersions: [...new Set(fixtures.map((fixture) => fixture.version))],
    trajectories
  };
}

export function runStructuredSyntheticAudit(input: {
  fixtureVersions: string[];
  trajectories: StructuredSyntheticTrajectory[];
}): StructuredSyntheticAuditRun {
  validateCombinedTrajectories(input.trajectories);
  const cases = input.trajectories.map(runTrajectory);
  const personas = [...new Set(cases.map((item) => item.personaId))].sort();
  const evidencePassed = cases.filter(
    (item) => item.evidenceProvenancePassed
  ).length;
  const keywordCases = cases.filter(
    (item) => item.personaId === "keyword_gamer"
  );
  const keywordPasses = keywordCases.filter(
    (item) => item.keywordGamerTransferPass
  ).length;

  const byTreatment = Object.fromEntries(
    treatmentOrder.map((treatment) => [
      treatment,
      summarizeGroup(cases.filter((item) => item.treatment === treatment))
    ])
  ) as Record<SyntheticTreatment, StructuredSyntheticAuditGroup>;
  const byPersona = Object.fromEntries(
    personas.map((persona) => [
      persona,
      summarizeGroup(cases.filter((item) => item.personaId === persona))
    ])
  );
  const countsByTreatment = treatmentOrder.map(
    (treatment) =>
      cases.filter((item) => item.treatment === treatment).length
  );
  const countsBySkill = skillOrder.map(
    (skillId) => cases.filter((item) => item.skillId === skillId).length
  );
  const uniqueIds = new Set(cases.map((item) => item.id)).size === cases.length;
  const balancedTreatments = new Set(countsByTreatment).size === 1;
  const balancedSkills = new Set(countsBySkill).size === 1;
  const eachPersonaCoversEverySkillAndTreatment = personas.every((persona) =>
    skillOrder.every((skillId) =>
      treatmentOrder.every(
        (treatment) =>
          cases.filter(
            (item) =>
              item.personaId === persona &&
              item.skillId === skillId &&
              item.treatment === treatment
          ).length === 1
      )
    )
  );
  const treatmentMatchesRevisionOwnership = cases.every((item) =>
    item.treatment === "direct_ai"
      ? !item.learnerAuthoredRevision
      : item.learnerAuthoredRevision
  );
  const pairedColdBaselines = personas.every((persona) =>
    skillOrder.every((skillId) => {
      const group = input.trajectories.filter(
        (item) => item.personaId === persona && item.skillId === skillId
      );
      return (
        new Set(group.map((item) => item.coldPromptId)).size === 1 &&
        new Set(group.map((item) => item.coldAnswer)).size === 1 &&
        new Set(group.map((item) => item.coldSelfStatement)).size === 1
      );
    })
  );
  const matchedTransferPrompts = personas.every((persona) =>
    skillOrder.every((skillId) => {
      const group = input.trajectories.filter(
        (item) => item.personaId === persona && item.skillId === skillId
      );
      return new Set(group.map((item) => item.transferPromptId)).size === 1;
    })
  );
  const fixtureIntegrity = {
    uniqueIds,
    balancedTreatments,
    balancedSkills,
    eachPersonaCoversEverySkillAndTreatment,
    treatmentMatchesRevisionOwnership,
    pairedColdBaselines,
    matchedTransferPrompts,
    passed:
      uniqueIds &&
      balancedTreatments &&
      balancedSkills &&
      eachPersonaCoversEverySkillAndTreatment &&
      treatmentMatchesRevisionOwnership &&
      pairedColdBaselines &&
      matchedTransferPrompts
  };

  const summary: StructuredSyntheticAuditSummary = {
    auditVersion: SYNTHETIC_AUDIT_VERSION,
    fixtureVersions: input.fixtureVersions,
    totalTrajectories: cases.length,
    personas,
    treatments: treatmentOrder,
    skills: skillOrder,
    evidenceProvenanceRate: safeRate(evidencePassed, cases.length),
    keywordGamerTransferPasses: {
      count: keywordPasses,
      eligibleTrajectories: keywordCases.length,
      rate: safeRate(keywordPasses, keywordCases.length),
      interpretation:
        "这里只表示关键词投机角色的迁移回答被当前规则判为达标；其中可能包含语义完整答案，必须逐例复核，不能直接视为误判率。"
    },
    byTreatment,
    byPersona,
    fixtureIntegrity,
    limitations: [
      "这是角色设定驱动的合成用户审计，不是真实用户 Pilot。",
      "生成角色可能共享同一模型偏差，措辞多样性和真实摩擦会被高估。",
      "评分器与训练产品使用同一套确定性规则，因此本报告不能独立证明学习效果。",
      "即时迁移表现不能证明人类在 24–72 小时后保持，也不能证明现实工作迁移。",
      "组间差异只是冻结合成任务上的诊断信号，不具有现实世界因果解释。"
    ]
  };

  return {
    summary,
    cases,
    markdown: renderStructuredSyntheticAuditMarkdown(summary, cases)
  };
}

export function renderStructuredSyntheticAuditMarkdown(
  summary: StructuredSyntheticAuditSummary,
  cases: StructuredSyntheticAuditCase[]
) {
  const treatmentLabels: Record<SyntheticTreatment, string> = {
    stg: "完整 STG",
    direct_ai: "直接获得改稿",
    practice_only: "只重复作答"
  };
  const treatmentRows = treatmentOrder.map((treatment) => {
    const item = summary.byTreatment[treatment];
    return `| ${treatmentLabels[treatment]} | ${item.trajectories} | ${formatPercent(item.coldMetRate)} | ${formatPercent(item.revisionCanContinueRate)} | ${formatPercent(item.learnerAuthoredImprovementRate)} | ${formatPercent(item.transferMetRate)} |`;
  });
  const personaRows = summary.personas.map((persona) => {
    const item = summary.byPersona[persona];
    return `| ${persona} | ${item.trajectories} | ${formatPercent(item.revisionCanContinueRate)} | ${formatPercent(item.transferMetRate)} |`;
  });
  const keywordPassCases = cases.filter(
    (item) => item.keywordGamerTransferPass
  );

  return [
    "# v0.4 合成用户审计",
    "",
    "> 本报告不是用户研究、Pilot 或学习效果证明。它只描述冻结的角色模拟输入在当前确定性规则下产生的结果。",
    "",
    `- 审计版本：\`${summary.auditVersion}\``,
    `- 合成轨迹：${summary.totalTrajectories}`,
    `- 行为角色：${summary.personas.length}`,
    `- 微技能：${summary.skills.length}`,
    `- Fixture 完整性：${summary.fixtureIntegrity.passed ? "通过" : "失败"}`,
    `- 证据来自对应回答：${formatPercent(summary.evidenceProvenanceRate)}`,
    "",
    "## 按训练机制观察",
    "",
    "| 训练机制 | 轨迹 | 冷答达标 | 重写可继续 | 学习者亲自改善 | 未见题迁移达标 |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...treatmentRows,
    "",
    "“直接获得改稿”的重写结果并非学习者创作，不能将其重写达标率解释为学习。更值得观察的是未见题迁移，但该指标仍只是合成诊断信号。",
    "",
    "## 按行为角色观察",
    "",
    "| 角色 | 轨迹 | 重写可继续 | 未见题迁移达标 |",
    "| --- | ---: | ---: | ---: |",
    ...personaRows,
    "",
    "## 关键词投机复核队列",
    "",
    `关键词投机角色共有 ${summary.keywordGamerTransferPasses.eligibleTrajectories} 条轨迹，其中 ${summary.keywordGamerTransferPasses.count} 条迁移回答被规则判为达标。`,
    "",
    summary.keywordGamerTransferPasses.interpretation,
    "",
    ...(keywordPassCases.length > 0
      ? [
          "| Case | 技能 | 训练机制 |",
          "| --- | --- | --- |",
          ...keywordPassCases.map(
            (item) => `| ${item.id} | ${item.skillId} | ${item.treatment} |`
          ),
          ""
        ]
      : []),
    "## 使用边界",
    "",
    ...summary.limitations.map((item) => `- ${item}`),
    "",
    "## 下一步",
    "",
    "- 逐例复核关键词投机通过项，优先提出通用语义/完整性修复，不针对单句硬编码。",
    "- 由产品开发者执行 14 天单人冷测，记录输入成本、卡点和遗忘；仍不冒充目标用户 Pilot。",
    "- 一旦可接触真实用户，用真实错误分布校准这些角色与 Fixture，冲突时以真实证据为准。",
    ""
  ].join("\n");
}

function runTrajectory(
  trajectory: StructuredSyntheticTrajectory
): StructuredSyntheticAuditCase {
  const coldPrompt = getStructuredPracticePrompt(trajectory.coldPromptId);
  const transferPrompt = getStructuredPracticePrompt(trajectory.transferPromptId);
  if (
    coldPrompt.kind !== "cold" ||
    !["near_transfer", "far_transfer"].includes(transferPrompt.kind)
  ) {
    throw new Error(`Trajectory ${trajectory.id} uses an invalid prompt kind.`);
  }

  const cold = evaluateStructuredAnswer({
    skillId: trajectory.skillId,
    answer: trajectory.coldAnswer,
    selfStatement: trajectory.coldSelfStatement,
    evaluation: coldPrompt.evaluation
  });
  const revision = evaluateStructuredAnswer({
    skillId: trajectory.skillId,
    answer: trajectory.revisionAnswer,
    selfStatement: trajectory.coldSelfStatement,
    evaluation: coldPrompt.evaluation
  });
  const transfer = evaluateStructuredAnswer({
    skillId: trajectory.skillId,
    answer: trajectory.transferAnswer,
    selfStatement: trajectory.transferSelfStatement,
    evaluation: transferPrompt.evaluation
  });
  const revisionChange = evaluateRevisionChange({
    beforeAnswer: trajectory.coldAnswer,
    afterAnswer: trajectory.revisionAnswer,
    before: cold,
    after: revision
  });

  return {
    id: trajectory.id,
    personaId: trajectory.personaId,
    skillId: trajectory.skillId,
    treatment: trajectory.treatment,
    learnerAuthoredRevision: trajectory.learnerAuthoredRevision,
    coldStatus: cold.status,
    revisionStatus: revision.status,
    transferStatus: transfer.status,
    revisionChange: revisionChange.kind,
    revisionCanContinue: revisionChange.canContinue,
    evidenceProvenancePassed: [cold, revision, transfer].every(
      (assessment, index) => {
        const answer = [
          trajectory.coldAnswer,
          trajectory.revisionAnswer,
          trajectory.transferAnswer
        ][index];
        return evidenceComesFromAnswer(answer, assessment);
      }
    ),
    keywordGamerTransferPass:
      trajectory.personaId === "keyword_gamer" &&
      transfer.status === "met",
    behaviorNotes: trajectory.behaviorNotes
  };
}

function summarizeGroup(
  cases: StructuredSyntheticAuditCase[]
): StructuredSyntheticAuditGroup {
  const authoredCases = cases.filter((item) => item.learnerAuthoredRevision);
  const coldMet = cases.filter((item) => item.coldStatus === "met").length;
  const revisionCanContinue = cases.filter(
    (item) => item.revisionCanContinue
  ).length;
  const learnerAuthoredImprovement = authoredCases.filter(
    (item) => item.revisionCanContinue
  ).length;
  const transferMet = cases.filter(
    (item) => item.transferStatus === "met"
  ).length;

  return {
    trajectories: cases.length,
    coldMet,
    coldMetRate: safeRate(coldMet, cases.length),
    revisionCanContinue,
    revisionCanContinueRate: safeRate(revisionCanContinue, cases.length),
    learnerAuthoredRevision: authoredCases.length,
    learnerAuthoredRevisionRate: safeRate(authoredCases.length, cases.length),
    learnerAuthoredImprovement,
    learnerAuthoredImprovementRate: safeRate(
      learnerAuthoredImprovement,
      authoredCases.length
    ),
    transferMet,
    transferMetRate: safeRate(transferMet, cases.length)
  };
}

function evidenceComesFromAnswer(answer: string, assessment: SkillAssessment) {
  if (!assessment.evidenceSpan) return false;
  const cited = assessment.evidence
    .trim()
    .replace(/^[\"“]/, "")
    .replace(/[\"”]$/, "")
    .replace(/…$/, "");
  return (
    answer.slice(
      assessment.evidenceSpan.start,
      assessment.evidenceSpan.end
    ) === cited
  );
}

function validateFixture(input: unknown): StructuredSyntheticFixture {
  if (!input || typeof input !== "object") {
    throw new Error("Synthetic fixture must be an object.");
  }
  const fixture = input as Partial<StructuredSyntheticFixture>;
  if (
    typeof fixture.version !== "string" ||
    !Array.isArray(fixture.personas) ||
    !Array.isArray(fixture.trajectories)
  ) {
    throw new Error("Synthetic fixture is missing version, personas, or trajectories.");
  }
  return {
    version: fixture.version,
    personas: fixture.personas.map((item) => String(item)),
    trajectories: fixture.trajectories.map(validateTrajectory)
  };
}

function validateTrajectory(
  input: unknown,
  index: number
): StructuredSyntheticTrajectory {
  if (!input || typeof input !== "object") {
    throw new Error(`Synthetic trajectory ${index} must be an object.`);
  }
  const item = input as Record<string, unknown>;
  const stringKeys = [
    "id",
    "personaId",
    "skillId",
    "treatment",
    "coldPromptId",
    "transferPromptId",
    "coldAnswer",
    "coldSelfStatement",
    "revisionAnswer",
    "transferAnswer",
    "transferSelfStatement",
    "behaviorNotes"
  ] as const;
  for (const key of stringKeys) {
    if (typeof item[key] !== "string" || item[key].trim().length === 0) {
      throw new Error(`Synthetic trajectory ${index} has invalid ${key}.`);
    }
  }
  for (const key of ["coldAnswer", "revisionAnswer", "transferAnswer"] as const) {
    if (String(item[key]).trim().length < 20) {
      throw new Error(
        `Synthetic trajectory ${index} has an answer below the app minimum length.`
      );
    }
  }
  if (
    !skillOrder.includes(item.skillId as StructuredSkillId) ||
    !treatmentOrder.includes(item.treatment as SyntheticTreatment) ||
    typeof item.learnerAuthoredRevision !== "boolean"
  ) {
    throw new Error(`Synthetic trajectory ${index} has an invalid enum or ownership.`);
  }

  const coldPrompt = getStructuredPracticePrompt(String(item.coldPromptId));
  const transferPrompt = getStructuredPracticePrompt(
    String(item.transferPromptId)
  );
  if (
    coldPrompt.kind !== "cold" ||
    !["near_transfer", "far_transfer"].includes(transferPrompt.kind)
  ) {
    throw new Error(`Synthetic trajectory ${index} uses an invalid prompt.`);
  }

  return item as StructuredSyntheticTrajectory;
}

function validateCombinedTrajectories(
  trajectories: StructuredSyntheticTrajectory[]
) {
  if (trajectories.length === 0) {
    throw new Error("Synthetic audit needs at least one trajectory.");
  }
  const ids = trajectories.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Synthetic trajectory ids must be unique.");
  }
}

function safeRate(numerator: number, denominator: number) {
  if (denominator === 0) return 0;
  return round(numerator / denominator);
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
