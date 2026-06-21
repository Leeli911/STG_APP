import {
  MAX_LIVE_SMOKE_CASES,
  parseLiveSmokeArgs,
  runLiveSmokeCommand,
  type LiveSmokeCaseSummary
} from "@/server/validation/liveSmoke";
import {
  runLiveAttemptVerificationCommand,
  type LiveAttemptVerificationSource
} from "@/server/validation/liveAttemptVerifier";

function createOutputCollector() {
  const lines: string[] = [];

  return {
    lines,
    output: {
      write(line: string) {
        lines.push(line);
      }
    }
  };
}

function completedSummary(caseId: string): LiveSmokeCaseSummary {
  return {
    case_id: caseId,
    analysis_success: true,
    coaching_success: true,
    json_validation_success: true,
    repair_count: 0,
    total_score: 68,
    latency_ms: {
      analysis: 100,
      coaching: 120,
      total: 240
    },
    fact_guard_result: "passed",
    final_status: "completed"
  };
}

describe("Module 8B live validation support", () => {
  test("live smoke exits before execution when OPENAI_API_KEY is missing", async () => {
    const executeCase = vi.fn();
    const collector = createOutputCollector();

    const exitCode = await runLiveSmokeCommand({
      args: [],
      env: {
        STG_AI_MODE: "live"
      },
      executeCase,
      output: collector.output
    });

    expect(exitCode).toBe(1);
    expect(executeCase).not.toHaveBeenCalled();
    expect(collector.lines.join("\n")).toContain(
      "OPENAI_API_KEY is required"
    );
  });

  test("live smoke rejects mock mode instead of falling back", async () => {
    const executeCase = vi.fn();
    const collector = createOutputCollector();

    const exitCode = await runLiveSmokeCommand({
      args: [],
      env: {
        STG_AI_MODE: "mock",
        OPENAI_API_KEY: "sk-test-secret"
      },
      executeCase,
      output: collector.output
    });

    expect(exitCode).toBe(1);
    expect(executeCase).not.toHaveBeenCalled();
    expect(collector.lines.join("\n")).toContain(
      "STG_AI_MODE must be explicitly set to live"
    );
  });

  test("live smoke defaults to exactly one Golden Case", () => {
    expect(parseLiveSmokeArgs([])).toEqual({
      caseIds: ["case-01"],
      allowMultiple: false
    });
  });

  test("live smoke rejects a case count above the hard maximum", () => {
    const args = ["--allow-multiple"];

    for (let index = 1; index <= MAX_LIVE_SMOKE_CASES + 1; index += 1) {
      args.push("--case", `case-${String(index).padStart(2, "0")}`);
    }

    expect(() => parseLiveSmokeArgs(args)).toThrow(
      `Live smoke is limited to ${MAX_LIVE_SMOKE_CASES} cases`
    );
  });

  test("live smoke output redacts the API key even when an error contains it", async () => {
    const apiKey = "sk-live-do-not-print";
    const collector = createOutputCollector();

    const exitCode = await runLiveSmokeCommand({
      args: ["--case", "case-01"],
      env: {
        STG_AI_MODE: "live",
        OPENAI_API_KEY: apiKey
      },
      executeCase: async () => {
        throw new Error(`Provider rejected ${apiKey}`);
      },
      output: collector.output
    });

    expect(exitCode).toBe(1);
    expect(collector.lines.join("\n")).not.toContain(apiKey);
    expect(collector.lines.join("\n")).toContain("[REDACTED]");
  });

  test("live smoke prints the required structured summary", async () => {
    const collector = createOutputCollector();

    const exitCode = await runLiveSmokeCommand({
      args: ["--case", "case-01"],
      env: {
        STG_AI_MODE: "live",
        OPENAI_API_KEY: "sk-test-secret"
      },
      executeCase: async (goldenCase) => completedSummary(goldenCase.id),
      output: collector.output
    });

    const output = collector.lines.join("\n");
    expect(exitCode).toBe(0);
    expect(output).toContain("real OpenAI API charges");
    expect(output).toContain('"case_id": "case-01"');
    expect(output).toContain('"analysis_success": true');
    expect(output).toContain('"fact_guard_result": "passed"');
    expect(output).toContain('"final_status": "completed"');
  });

  test("database verifier does not output answers or rewrites", async () => {
    const privateAnswer = "PRIVATE ORIGINAL ANSWER";
    const privateRewrite = "PRIVATE AI REWRITE";
    const collector = createOutputCollector();
    const source: LiveAttemptVerificationSource = {
      async findAttempt() {
        return {
          id: "00000000-0000-4000-8000-000000000001",
          status: "completed",
          analysis_prompt_version: "analysis/v1",
          coaching_prompt_version: "coaching/v1",
          ai_model: "gpt-4.1-mini",
          repair_count: 0,
          analysis_latency_ms: 100,
          coaching_latency_ms: 120,
          total_latency_ms: 240,
          answer_text: privateAnswer
        };
      },
      async findScore() {
        return {
          attempt_id: "00000000-0000-4000-8000-000000000001",
          total_score: 68
        };
      },
      async findFeedback() {
        return {
          attempt_id: "00000000-0000-4000-8000-000000000001",
          observable_features: {
            has_clear_opening_claim: true
          },
          safety_flags: [],
          rewrite: privateRewrite
        };
      }
    };

    const exitCode = await runLiveAttemptVerificationCommand({
      args: ["00000000-0000-4000-8000-000000000001"],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-secret"
      },
      source,
      output: collector.output
    });

    const output = collector.lines.join("\n");
    expect(exitCode).toBe(0);
    expect(output).not.toContain(privateAnswer);
    expect(output).not.toContain(privateRewrite);
    expect(output).not.toContain("service-role-secret");
    expect(output).toContain('"scores_exists": true');
    expect(output).toContain('"ai_feedback_exists": true');
    expect(output).toContain('"observable_features_exists": true');
    expect(output).toContain('"safety_flags_exists": true');
  });
});
