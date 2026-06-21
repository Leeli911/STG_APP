export type AiGenerateJsonInput = {
  system: string;
  user: string;
  model: string;
  temperature: number;
  timeoutMs: number;
};

export type AiGenerateJsonResult = {
  text: string;
  model: string;
  latencyMs: number;
};

export type StgAiClient = {
  generateJson: (input: AiGenerateJsonInput) => Promise<AiGenerateJsonResult>;
};
