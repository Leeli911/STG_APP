import OpenAI from "openai";
import type {
  Response,
  ResponseCreateParamsNonStreaming
} from "openai/resources/responses/responses";

import type {
  AiBackgroundResponseResult,
  AiGenerateJsonInput,
  AiWebhookEvent,
  AiWebhookVerifier,
  StgBackgroundAiClient
} from "@/server/ai/types";

export function createOpenAiClient(apiKey: string): StgBackgroundAiClient {
  const client = new OpenAI({ apiKey });

  return {
    async generateJson(input) {
      const startedAt = Date.now();
      const response = await client.responses.create(
        buildOpenAiResponseParams(input, false),
        buildOpenAiRequestOptions(input)
      );

      if (response.status && response.status !== "completed") {
        throw new Error(`OpenAI response ended with status ${response.status}.`);
      }

      return {
        text: response.output_text,
        model: response.model,
        latencyMs: Date.now() - startedAt,
        responseId: response.id,
        ...mapUsage(response)
      };
    },

    async startBackgroundJson(input) {
      const response = await client.responses.create(
        buildOpenAiResponseParams(input, true),
        buildOpenAiRequestOptions(input)
      );

      return {
        responseId: response.id,
        status: response.status ?? "queued",
        model: response.model
      };
    },

    async retrieveBackgroundJson(responseId, timeoutMs = 30_000) {
      const response = await client.responses.retrieve(
        responseId,
        undefined,
        { timeout: timeoutMs }
      );
      return mapBackgroundResponse(response);
    }
  };
}

export function createOpenAiWebhookVerifier({
  apiKey,
  webhookSecret
}: {
  apiKey: string;
  webhookSecret: string;
}): AiWebhookVerifier {
  const client = new OpenAI({ apiKey, webhookSecret });

  return {
    async unwrap(payload, headers) {
      const event = await client.webhooks.unwrap(payload, headers);
      switch (event.type) {
        case "response.completed":
        case "response.failed":
        case "response.cancelled":
        case "response.incomplete":
          return {
            eventId: event.id,
            type: event.type,
            responseId: event.data.id,
            createdAt: event.created_at
          } satisfies AiWebhookEvent;
        default:
          return null;
      }
    }
  };
}

export function buildOpenAiResponseParams(
  input: AiGenerateJsonInput,
  background: boolean
): ResponseCreateParamsNonStreaming {
  return {
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
    background,
    text: {
      format: {
        type: "json_schema",
        name: input.output.name,
        schema: input.output.schema,
        strict: true
      }
    }
  };
}

export function buildOpenAiRequestOptions(input: AiGenerateJsonInput) {
  return {
    timeout: input.timeoutMs,
    ...(input.idempotencyKey
      ? { idempotencyKey: input.idempotencyKey }
      : {})
  };
}

function mapBackgroundResponse(response: Response): AiBackgroundResponseResult {
  return {
    responseId: response.id,
    status: response.status ?? (response.output_text ? "completed" : "in_progress"),
    model: response.model,
    text: response.status === "completed" ? response.output_text : null,
    errorCode: response.error?.code ?? null,
    ...mapUsage(response)
  };
}

function mapUsage(response: Response) {
  if (!response.usage) {
    return {};
  }

  return {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.total_tokens
  };
}
