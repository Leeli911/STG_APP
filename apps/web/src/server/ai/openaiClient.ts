import OpenAI from "openai";

import type { StgAiClient } from "@/server/ai/types";

export function createOpenAiClient(apiKey: string): StgAiClient {
  const client = new OpenAI({
    apiKey
  });

  return {
    async generateJson(input) {
      const startedAt = Date.now();
      const response = await client.responses.create(
        {
          model: input.model,
          input: [
            {
              role: "system",
              content: input.system
            },
            {
              role: "user",
              content: input.user
            }
          ],
          temperature: input.temperature,
          text: {
            format: {
              type: "json_object"
            }
          }
        } as never,
        {
          timeout: input.timeoutMs
        }
      );

      const outputText =
        typeof (response as { output_text?: unknown }).output_text === "string"
          ? ((response as { output_text: string }).output_text)
          : JSON.stringify(response);

      return {
        text: outputText,
        model: input.model,
        latencyMs: Date.now() - startedAt
      };
    }
  };
}
