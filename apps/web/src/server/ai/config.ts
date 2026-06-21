export type AiMode = "mock" | "live";

export type AiRuntimeConfig = {
  mode: AiMode;
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
};

export function getAiRuntimeConfig(env: EnvLike = process.env): AiRuntimeConfig {
  const mode = resolveAiMode(env);
  const model = env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (mode === "live" && !env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required in live mode.");
  }

  return {
    mode,
    model,
    analysisTemperature: 0.1,
    coachingTemperature: 0.2,
    repairTemperature: 0,
    timeoutMs: 30_000,
    apiKey: env.OPENAI_API_KEY
  };
}

function resolveAiMode(env: EnvLike): AiMode {
  if (env.STG_AI_MODE === "mock" || env.STG_AI_MODE === "live") {
    return env.STG_AI_MODE;
  }

  return env.NODE_ENV === "production" ? "live" : "mock";
}
