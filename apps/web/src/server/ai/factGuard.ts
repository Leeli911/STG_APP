import type { CoachingOutput } from "@/schemas/ai";

const TOOL_OR_COMPANY_PATTERN =
  /\b(SQL|Tableau|Python|Excel|Power BI|Spark|AWS|Google|Meta|Amazon|Microsoft)\b|阿里|腾讯|字节|百度|美团/g;
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?%?\b/g;

export type FactGuardResult = {
  ok: boolean;
  flags: Array<{
    flag_type: string;
    severity: "high" | "medium" | "low";
    message: string;
  }>;
};

export function checkRewriteFactPreservation({
  originalAnswer,
  coaching
}: {
  originalAnswer: string;
  coaching: CoachingOutput;
}): FactGuardResult {
  const rewrite = coaching.rewrite.text;
  const flags = [
    ...findNewMatches("unsupported_number", NUMBER_PATTERN, originalAnswer, rewrite),
    ...findNewMatches(
      "unsupported_tool_or_company",
      TOOL_OR_COMPANY_PATTERN,
      originalAnswer,
      rewrite
    )
  ];

  return {
    ok: flags.length === 0,
    flags
  };
}

function findNewMatches(
  flagType: string,
  pattern: RegExp,
  originalAnswer: string,
  rewrite: string
) {
  const originalMatches = new Set(originalAnswer.match(pattern) ?? []);
  const rewriteMatches = rewrite.match(pattern) ?? [];

  return rewriteMatches
    .filter((match) => !originalMatches.has(match))
    .map((match) => ({
      flag_type: flagType,
      severity: "high" as const,
      message: `Rewrite introduced unsupported fact: ${match}`
    }));
}
