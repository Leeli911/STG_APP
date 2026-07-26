import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getStructuredPracticePrompt } from "@/features/structured-practice/curriculum";
import { evaluateStructuredAnswer } from "@/features/structured-practice/ruleEngine";
import type {
  SkillAssessment,
  SkillAssessmentStatus,
  StructuredSkillId
} from "@/features/structured-practice/types";

export const STRUCTURED_EVAL_VERSION = "structured-practice-rule-gold-v1";

const statuses: SkillAssessmentStatus[] = [
  "met",
  "partial",
  "uncertain",
  "needs_work"
];

export type StructuredPracticeEvalCase = {
  id: string;
  skillId: StructuredSkillId;
  promptId: string;
  answer: string;
  selfStatement: string;
  expectedStatus: SkillAssessmentStatus;
  expectedTaskStatus: SkillAssessmentStatus;
  tags: string[];
  acceptableEvidence: string[];
};

export type StructuredPracticeGoldenSet = {
  version: string;
  cases: StructuredPracticeEvalCase[];
};

export type ConfusionMatrix = Record<
  SkillAssessmentStatus,
  Record<SkillAssessmentStatus, number>
>;

export type StatusMetric = {
  support: number;
  predicted: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
};

export type StructuredPracticeEvalCaseResult = {
  id: string;
  skillId: StructuredSkillId;
  promptId: string;
  tags: string[];
  expectedStatus: SkillAssessmentStatus;
  actualStatus: SkillAssessmentStatus;
  expectedTaskStatus: SkillAssessmentStatus;
  actualTaskStatus: SkillAssessmentStatus;
  statusCorrect: boolean;
  taskStatusCorrect: boolean;
  evidence: string;
  evidenceFromAnswer: boolean;
  evidenceMatchesGold: boolean;
  deterministic: boolean;
  assessment: SkillAssessment;
};

export type StructuredPracticeEvalSummary = {
  evalVersion: string;
  ruleVersions: string[];
  totalCases: number;
  accuracy: number;
  taskAccuracy: number;
  macroF1: number;
  confusionMatrix: ConfusionMatrix;
  taskConfusionMatrix: ConfusionMatrix;
  statusMetrics: Record<SkillAssessmentStatus, StatusMetric>;
  severeFalsePass: {
    count: number;
    eligibleCases: number;
    rate: number;
  };
  evidenceProvenance: {
    passedCases: number;
    rate: number;
  };
  evidenceGoldMatch: {
    passedCases: number;
    rate: number;
  };
  determinism: {
    passedCases: number;
    rate: number;
  };
  releaseGate: {
    macroF1AtLeast090: boolean;
    severeFalsePassAtMost002: boolean;
    evidenceProvenanceIs100Percent: boolean;
    evidenceGoldMatchAtLeast095: boolean;
    determinismIs100Percent: boolean;
    passed: boolean;
  };
};

export type StructuredPracticeEvalRun = {
  summary: StructuredPracticeEvalSummary;
  cases: StructuredPracticeEvalCaseResult[];
  markdown: string;
};

export function loadStructuredPracticeGoldenSet(
  path = join(
    process.cwd(),
    "src",
    "tests",
    "golden",
    "structured-practice-rule-gold-v1.json"
  )
): StructuredPracticeGoldenSet {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return validateGoldenSet(parsed);
}

export function runStructuredPracticeEval(
  goldenSet: StructuredPracticeGoldenSet
): StructuredPracticeEvalRun {
  const validated = validateGoldenSet(goldenSet);
  const results = validated.cases.map(runCase);
  const confusionMatrix = createConfusionMatrix();
  const taskConfusionMatrix = createConfusionMatrix();

  for (const result of results) {
    confusionMatrix[result.expectedStatus][result.actualStatus] += 1;
    taskConfusionMatrix[result.expectedTaskStatus][result.actualTaskStatus] += 1;
  }

  const totalCases = results.length;
  const statusMetrics = calculateStatusMetrics(confusionMatrix);
  const activeStatusMetrics = statuses
    .map((status) => statusMetrics[status])
    .filter((metric) => metric.support > 0 || metric.predicted > 0);
  const severeFalsePassCount = results.filter(
    (result) =>
      result.expectedStatus === "needs_work" &&
      result.actualStatus === "met"
  ).length;
  const severeFalsePassEligible = results.filter(
    (result) => result.expectedStatus === "needs_work"
  ).length;
  const evidencePassedCases = results.filter(
    (result) => result.evidenceFromAnswer
  ).length;
  const deterministicCases = results.filter(
    (result) => result.deterministic
  ).length;
  const evidenceGoldCases = results.filter(
    (result) => result.evidenceMatchesGold
  ).length;

  const summary: StructuredPracticeEvalSummary = {
    evalVersion: validated.version,
    ruleVersions: [
      ...new Set(results.map((result) => result.assessment.ruleVersion))
    ].sort(),
    totalCases,
    accuracy: safeRate(
      results.filter((result) => result.statusCorrect).length,
      totalCases
    ),
    taskAccuracy: safeRate(
      results.filter((result) => result.taskStatusCorrect).length,
      totalCases
    ),
    macroF1: round(
      activeStatusMetrics.length === 0
        ? 0
        : activeStatusMetrics.reduce((total, metric) => total + metric.f1, 0) /
            activeStatusMetrics.length
    ),
    confusionMatrix,
    taskConfusionMatrix,
    statusMetrics,
    severeFalsePass: {
      count: severeFalsePassCount,
      eligibleCases: severeFalsePassEligible,
      rate: safeRate(severeFalsePassCount, severeFalsePassEligible)
    },
    evidenceProvenance: {
      passedCases: evidencePassedCases,
      rate: safeRate(evidencePassedCases, totalCases)
    },
    evidenceGoldMatch: {
      passedCases: evidenceGoldCases,
      rate: safeRate(evidenceGoldCases, totalCases)
    },
    determinism: {
      passedCases: deterministicCases,
      rate: safeRate(deterministicCases, totalCases)
    },
    releaseGate: {
      macroF1AtLeast090: false,
      severeFalsePassAtMost002: false,
      evidenceProvenanceIs100Percent: false,
      evidenceGoldMatchAtLeast095: false,
      determinismIs100Percent: false,
      passed: false
    }
  };

  summary.releaseGate.macroF1AtLeast090 = summary.macroF1 >= 0.9;
  summary.releaseGate.severeFalsePassAtMost002 =
    summary.severeFalsePass.rate <= 0.02;
  summary.releaseGate.evidenceProvenanceIs100Percent =
    summary.evidenceProvenance.rate === 1;
  summary.releaseGate.evidenceGoldMatchAtLeast095 =
    summary.evidenceGoldMatch.rate >= 0.95;
  summary.releaseGate.determinismIs100Percent =
    summary.determinism.rate === 1;
  summary.releaseGate.passed = Object.entries(summary.releaseGate)
    .filter(([key]) => key !== "passed")
    .every(([, value]) => value);

  return {
    summary,
    cases: results,
    markdown: renderStructuredPracticeEvalMarkdown(summary, results)
  };
}

export function renderStructuredPracticeEvalMarkdown(
  summary: StructuredPracticeEvalSummary,
  cases: StructuredPracticeEvalCaseResult[]
) {
  const failedCases = cases.filter(
    (item) =>
      !item.statusCorrect ||
      !item.taskStatusCorrect ||
      !item.evidenceFromAnswer ||
      !item.evidenceMatchesGold ||
      !item.deterministic
  );
  const matrixHeader = `| 预期 \\\\ 实际 | ${statuses.join(" | ")} |`;
  const matrixSeparator = `|---|${statuses.map(() => "---:").join("|")}|`;
  const matrixRows = statuses.map(
    (expected) =>
      `| ${expected} | ${statuses
        .map((actual) => summary.confusionMatrix[expected][actual])
        .join(" | ")} |`
  );

  return [
    "# 结构化表达规则评测报告",
    "",
    `- 评测集：\`${summary.evalVersion}\``,
    `- 样本数：${summary.totalCases}`,
    `- 状态准确率：${formatPercent(summary.accuracy)}`,
    `- 任务状态准确率：${formatPercent(summary.taskAccuracy)}`,
    `- Macro-F1：${summary.macroF1.toFixed(3)}`,
    `- 严重假通过率（needs_work → met）：${formatPercent(summary.severeFalsePass.rate)}（${summary.severeFalsePass.count}/${summary.severeFalsePass.eligibleCases}）`,
    `- 证据来自原文：${formatPercent(summary.evidenceProvenance.rate)}`,
    `- 正确证据命中：${formatPercent(summary.evidenceGoldMatch.rate)}`,
    `- 确定性：${formatPercent(summary.determinism.rate)}`,
    `- 发布门：${summary.releaseGate.passed ? "通过" : "未通过"}`,
    "",
    "## 状态混淆矩阵",
    "",
    matrixHeader,
    matrixSeparator,
    ...matrixRows,
    "",
    "## 未通过案例",
    "",
    ...(failedCases.length === 0
      ? ["无。"]
      : failedCases.map(
          (item) =>
            `- \`${item.id}\`：技能状态 ${item.expectedStatus} → ${item.actualStatus}；任务状态 ${item.expectedTaskStatus} → ${item.actualTaskStatus}；证据溯源 ${item.evidenceFromAnswer ? "通过" : "失败"}；正确证据 ${item.evidenceMatchesGold ? "通过" : "失败"}；确定性 ${item.deterministic ? "通过" : "失败"}`
        )),
    ""
  ].join("\n");
}

function runCase(
  evalCase: StructuredPracticeEvalCase
): StructuredPracticeEvalCaseResult {
  const prompt = getStructuredPracticePrompt(evalCase.promptId);
  const input = {
    skillId: evalCase.skillId,
    answer: evalCase.answer,
    selfStatement: evalCase.selfStatement,
    evaluation: prompt.evaluation
  };
  const first = evaluateStructuredAnswer(input);
  const second = evaluateStructuredAnswer(input);

  return {
    id: evalCase.id,
    skillId: evalCase.skillId,
    promptId: evalCase.promptId,
    tags: [...evalCase.tags],
    expectedStatus: evalCase.expectedStatus,
    actualStatus: first.status,
    expectedTaskStatus: evalCase.expectedTaskStatus,
    actualTaskStatus: first.taskStatus,
    statusCorrect: first.status === evalCase.expectedStatus,
    taskStatusCorrect: first.taskStatus === evalCase.expectedTaskStatus,
    evidence: first.evidence,
    evidenceFromAnswer: evidenceComesFromAnswer(
      first.evidence,
      evalCase.answer
    ) && evidenceSpanIsValid(first, evalCase.answer),
    evidenceMatchesGold: evidenceMatchesGold(
      first.evidence,
      evalCase.acceptableEvidence
    ),
    deterministic: JSON.stringify(first) === JSON.stringify(second),
    assessment: first
  };
}

function evidenceSpanIsValid(assessment: SkillAssessment, answer: string) {
  if (!assessment.evidenceSpan) return false;
  const { start, end } = assessment.evidenceSpan;
  if (start < 0 || end <= start || end > answer.length) return false;
  const cited = assessment.evidence
    .trim()
    .replace(/^["“]/, "")
    .replace(/["”]$/, "")
    .replace(/…$/, "");
  return answer.slice(start, end) === cited;
}

function evidenceMatchesGold(
  evidence: string,
  acceptableEvidence: string[]
) {
  const cited = evidence
    .trim()
    .replace(/^["“]/, "")
    .replace(/["”]$/, "")
    .replace(/…$/, "");
  return acceptableEvidence.some(
    (acceptable) =>
      cited.includes(acceptable) || acceptable.includes(cited)
  );
}

function evidenceComesFromAnswer(evidence: string, answer: string) {
  const quote = evidence
    .trim()
    .replace(/^["“]/, "")
    .replace(/["”]$/, "")
    .trim();
  if (!quote || !answer.trim()) return false;

  const exactPortion = quote.endsWith("…") ? quote.slice(0, -1) : quote;
  return exactPortion.length > 0 && answer.includes(exactPortion);
}

function calculateStatusMetrics(
  matrix: ConfusionMatrix
): Record<SkillAssessmentStatus, StatusMetric> {
  return Object.fromEntries(
    statuses.map((status) => {
      const truePositive = matrix[status][status];
      const support = statuses.reduce(
        (total, actual) => total + matrix[status][actual],
        0
      );
      const predicted = statuses.reduce(
        (total, expected) => total + matrix[expected][status],
        0
      );
      const falsePositive = predicted - truePositive;
      const falseNegative = support - truePositive;
      const precision = safeRate(truePositive, truePositive + falsePositive);
      const recall = safeRate(truePositive, truePositive + falseNegative);
      const f1 =
        precision + recall === 0
          ? 0
          : round((2 * precision * recall) / (precision + recall));

      return [
        status,
        {
          support,
          predicted,
          truePositive,
          falsePositive,
          falseNegative,
          precision,
          recall,
          f1
        }
      ];
    })
  ) as Record<SkillAssessmentStatus, StatusMetric>;
}

function createConfusionMatrix(): ConfusionMatrix {
  return Object.fromEntries(
    statuses.map((expected) => [
      expected,
      Object.fromEntries(statuses.map((actual) => [actual, 0]))
    ])
  ) as ConfusionMatrix;
}

function validateGoldenSet(value: unknown): StructuredPracticeGoldenSet {
  if (!isRecord(value) || typeof value.version !== "string") {
    throw new Error("Structured practice golden set requires a version.");
  }
  if (!Array.isArray(value.cases)) {
    throw new Error("Structured practice golden set requires a cases array.");
  }

  const seenIds = new Set<string>();
  const cases = value.cases.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Structured practice eval case ${index} must be an object.`);
    }

    const candidate = item as Partial<StructuredPracticeEvalCase>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.promptId !== "string" ||
      typeof candidate.answer !== "string" ||
      typeof candidate.selfStatement !== "string" ||
      !isSkillId(candidate.skillId) ||
      !isStatus(candidate.expectedStatus) ||
      !isStatus(candidate.expectedTaskStatus) ||
      !Array.isArray(candidate.tags) ||
      !candidate.tags.every((tag) => typeof tag === "string") ||
      !Array.isArray(candidate.acceptableEvidence) ||
      candidate.acceptableEvidence.length === 0 ||
      !candidate.acceptableEvidence.every(
        (evidence) => typeof evidence === "string" && evidence.length > 0
      )
    ) {
      throw new Error(`Structured practice eval case ${index} has an invalid schema.`);
    }
    if (seenIds.has(candidate.id)) {
      throw new Error(`Duplicate structured practice eval case id: ${candidate.id}`);
    }
    seenIds.add(candidate.id);

    return candidate as StructuredPracticeEvalCase;
  });

  return {
    version: value.version,
    cases
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatus(value: unknown): value is SkillAssessmentStatus {
  return statuses.includes(value as SkillAssessmentStatus);
}

function isSkillId(value: unknown): value is StructuredSkillId {
  return ["purpose", "conclusion_first", "grouping"].includes(
    value as StructuredSkillId
  );
}

function safeRate(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
