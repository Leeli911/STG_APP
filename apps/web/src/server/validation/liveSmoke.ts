import { loadGoldenSetV1, type GoldenCase } from "@/server/benchmarks/goldenSet";
import { runAiCoachPipeline } from "@/server/ai/pipeline";
import { createLiveSmokeRepository } from "@/server/validation/liveSmokeRepository";

export const DEFAULT_LIVE_SMOKE_CASE_ID = "case-01";
export const MAX_LIVE_SMOKE_CASES = 3;

export type LiveSmokeCaseSummary = {
  case_id: string;
  analysis_success: boolean;
  coaching_success: boolean;
  json_validation_success: boolean;
  repair_count: number;
  total_score: number | null;
  latency_ms: {
    analysis: number | null;
    coaching: number | null;
    total: number | null;
  };
  fact_guard_result: "passed" | "regenerated" | "failed" | "not_checked";
  final_status: string;
};

type LiveSmokeEnv = {
  STG_AI_MODE?: string;
  OPENAI_API_KEY?: string;
};

type CommandOutput = {
  write: (line: string) => void;
};

type RunLiveSmokeCommandInput = {
  args: string[];
  env: LiveSmokeEnv;
  executeCase?: (goldenCase: GoldenCase) => Promise<LiveSmokeCaseSummary>;
  output: CommandOutput;
};

export function parseLiveSmokeArgs(args: string[]) {
  const caseIds: string[] = [];
  let allowMultiple = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--allow-multiple") {
      allowMultiple = true;
      continue;
    }

    if (argument === "--all") {
      throw new Error("Running the full Golden Set is disabled for live smoke.");
    }

    if (argument === "--case") {
      const caseId = args[index + 1];
      if (!caseId || caseId.startsWith("--")) {
        throw new Error("--case requires a Golden Case id.");
      }
      caseIds.push(caseId);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported live smoke argument: ${argument}`);
  }

  const selectedCaseIds = caseIds.length
    ? [...new Set(caseIds)]
    : [DEFAULT_LIVE_SMOKE_CASE_ID];

  if (selectedCaseIds.length > 1 && !allowMultiple) {
    throw new Error("Multiple cases require the explicit --allow-multiple flag.");
  }

  if (selectedCaseIds.length > MAX_LIVE_SMOKE_CASES) {
    throw new Error(
      `Live smoke is limited to ${MAX_LIVE_SMOKE_CASES} cases per run.`
    );
  }

  return {
    caseIds: selectedCaseIds,
    allowMultiple
  };
}

export async function runLiveSmokeCommand({
  args,
  env,
  executeCase = executeLiveSmokeCase,
  output
}: RunLiveSmokeCommandInput): Promise<number> {
  try {
    validateLiveSmokeEnvironment(env);
    const selection = parseLiveSmokeArgs(args);
    const goldenCases = selectGoldenCases(selection.caseIds);

    output.write(
      `WARNING: This run makes real OpenAI API calls and will incur real OpenAI API charges. Case count: ${goldenCases.length}.`
    );

    let allCompleted = true;
    for (const goldenCase of goldenCases) {
      const summary = await executeCase(goldenCase);
      output.write(JSON.stringify(summary, null, 2));
      allCompleted = allCompleted && summary.final_status === "completed";
    }

    return allCompleted ? 0 : 1;
  } catch (error) {
    output.write(
      `Live smoke failed: ${sanitizeError(error, [
        env.OPENAI_API_KEY,
        ...loadGoldenSetV1().cases.map((item) => item.user_answer)
      ])}`
    );
    return 1;
  }
}

export function validateLiveSmokeEnvironment(env: LiveSmokeEnv) {
  if (env.STG_AI_MODE !== "live") {
    throw new Error("STG_AI_MODE must be explicitly set to live.");
  }

  if (!env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is required for live smoke.");
  }
}

export async function executeLiveSmokeCase(
  goldenCase: GoldenCase
): Promise<LiveSmokeCaseSummary> {
  const harness = createLiveSmokeRepository(goldenCase);

  try {
    await runAiCoachPipeline({
      mode: "live",
      userId: harness.userId,
      attempt: harness.attempt,
      question: harness.question,
      repository: harness.repository
    });
  } catch {
    // The structured snapshot below is safer and more useful than raw provider output.
  }

  const snapshot = harness.getSnapshot();
  const safetyFlags = snapshot.feedback?.safety_flags ?? [];
  const regenerated = safetyFlags.some(
    (flag) => flag.flag_type === "fact_guard_regenerated"
  );
  const analysisSuccess = snapshot.statuses.includes("coaching_running");
  const coachingSuccess = snapshot.attempt.status === "completed";
  const jsonValidationSuccess = Boolean(
    coachingSuccess && snapshot.score && snapshot.feedback
  );

  return {
    case_id: goldenCase.id,
    analysis_success: analysisSuccess,
    coaching_success: coachingSuccess,
    json_validation_success: jsonValidationSuccess,
    repair_count: snapshot.attempt.repair_count ?? 0,
    total_score: snapshot.score?.total_score ?? null,
    latency_ms: {
      analysis: snapshot.attempt.analysis_latency_ms ?? null,
      coaching: snapshot.attempt.coaching_latency_ms ?? null,
      total: snapshot.attempt.total_latency_ms ?? null
    },
    fact_guard_result:
      snapshot.attempt.error_code === "FACT_GUARD_FAILED"
        ? "failed"
        : regenerated
          ? "regenerated"
          : coachingSuccess
            ? "passed"
            : "not_checked",
    final_status: snapshot.attempt.status
  };
}

function selectGoldenCases(caseIds: string[]) {
  const goldenSet = loadGoldenSetV1();
  const caseMap = new Map(goldenSet.cases.map((item) => [item.id, item]));

  return caseIds.map((caseId) => {
    const goldenCase = caseMap.get(caseId);
    if (!goldenCase) {
      throw new Error(`Golden Case was not found: ${caseId}`);
    }
    return goldenCase;
  });
}

function sanitizeError(error: unknown, secrets: Array<string | undefined>) {
  let message = error instanceof Error ? error.message : "Unknown live smoke error.";

  for (const secret of secrets) {
    if (secret) {
      message = message.replaceAll(secret, "[REDACTED]");
    }
  }

  return message.slice(0, 500);
}
