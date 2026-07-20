import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AnalysisOutputSchema, type AnalysisOutput } from "@/schemas/ai";

export type GoldenCase = {
  id: string;
  title: string;
  question: string;
  user_answer: string;
  case_type: string;
  expected_analysis_raw: string;
  expected_diagnosis: string[];
  expected_score_range: {
    min: number;
    max: number;
  };
  language?: "zh" | "en" | "mixed";
  risk_tags?: string[];
};

export type GoldenSet = {
  version: "Golden Set V1" | "Golden Set V2";
  cases: GoldenCase[];
};

type GoldenSetSupplement = {
  version: "Golden Set V2 Supplement";
  cases: GoldenCase[];
};

const bannedPhrases = [
  "逻辑比较清晰",
  "表达不错",
  "建议进一步优化",
  "可以更具体",
  "内容比较完整",
  "结构有待提升",
  "需要加强说服力",
  "overall",
  "generally good",
  "quite clear",
  "needs improvement"
];

export function loadGoldenSetV1(): GoldenSet {
  const path = join(
    process.cwd(),
    "src",
    "tests",
    "golden",
    "golden-set-v1.json"
  );

  return JSON.parse(readFileSync(path, "utf8")) as GoldenSet;
}

export function loadGoldenSetV2(): GoldenSet {
  const supplementPath = join(
    process.cwd(),
    "src",
    "tests",
    "golden",
    "golden-set-v2-supplement.json"
  );
  const supplement = JSON.parse(
    readFileSync(supplementPath, "utf8")
  ) as GoldenSetSupplement;

  return {
    version: "Golden Set V2",
    cases: [...loadGoldenSetV1().cases, ...supplement.cases]
  };
}

export function runGoldenCaseChecks({
  goldenCase,
  analysis,
  coachingText
}: {
  goldenCase: GoldenCase;
  analysis: AnalysisOutput;
  coachingText: string;
}) {
  const parsed = AnalysisOutputSchema.safeParse(analysis);
  const totalScore =
    analysis.dimension_scores?.reduce((total, item) => total + item.score, 0) ?? -1;
  const bannedPhraseCount = bannedPhrases.filter((phrase) =>
    coachingText.toLowerCase().includes(phrase.toLowerCase())
  ).length;

  return {
    case_id: goldenCase.id,
    valid_json: parsed.success,
    total_score_valid: totalScore === analysis.score.total,
    expected_score_range_hit:
      analysis.score.total >= goldenCase.expected_score_range.min &&
      analysis.score.total <= goldenCase.expected_score_range.max,
    banned_phrase_count: bannedPhraseCount
  };
}
