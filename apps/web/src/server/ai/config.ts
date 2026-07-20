export type AiMode = "mock" | "live";
export type AiExecutionMode = "sync" | "background";

export const AI_MODEL_CANDIDATES = {
  baseline: "gpt-4.1-mini",
  costOptimized: "gpt-5.6-luna",
  qualityChallenger: "gpt-5.6-terra"
} as const;

export type AiRuntimeConfig = {
  mode: AiMode;
  executionMode: AiExecutionMode;
  model: string;
  analysisTemperature: number;
  coachingTemperature: number;
  repairTemperature: number;
  timeoutMs: number;
  apiKey?: string;
};

type EnvLike = {
  NODE_ENV?: string;
  STG_AI_MODE?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  STG_AI_EXECUTION_MODE?: string;
};

export function getAiRuntimeConfig(env: EnvLike = process.env): AiRuntimeConfig {
  const mode = resolveAiMode(env);
  const model = env.OPENAI_MODEL ?? AI_MODEL_CANDIDATES.baseline;
  const executionMode = resolveAiExecutionMode(env.STG_AI_EXECUTION_MODE);

  if (mode === "live" && !env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required in live mode.");
  }

  return {
    mode,
    executionMode,
    model,
    analysisTemperature: 0.1,
    coachingTemperature: 0.2,
    repairTemperature: 0,
    timeoutMs: 30_000,
    apiKey: env.OPENAI_API_KEY
  };
}

function resolveAiExecutionMode(value: string | undefined): AiExecutionMode {
  if (value === undefined || value === "sync") {
    return "sync";
  }
  if (value === "background") {
    return "background";
  }
  throw new Error("STG_AI_EXECUTION_MODE must be sync or background.");
}

function resolveAiMode(env: EnvLike): AiMode {
  if (env.STG_AI_MODE === "mock" || env.STG_AI_MODE === "live") {
    return env.STG_AI_MODE;
  }

  return env.NODE_ENV === "production" ? "live" : "mock";
}
