import { dispatchProviderResponse } from "@/server/ai/jobs/reconcileService";
import type { AiWebhookDependencies } from "@/server/ai/jobs/types";

export type AiWebhookOutcome =
  | { outcome: "ignored_event" }
  | { outcome: "unknown_response"; responseId: string }
  | { outcome: "already_claimed"; responseId: string }
  | { outcome: "processed"; responseId: string; status: string };

export async function processOpenAiWebhook(
  payload: string,
  headers: Headers,
  dependencies: AiWebhookDependencies
): Promise<AiWebhookOutcome> {
  const event = await dependencies.verifier.unwrap(payload, headers);
  if (!event) {
    return { outcome: "ignored_event" };
  }

  const job = await dependencies.repository.claimByProviderResponseId(
    event.responseId
  );
  if (!job) {
    return event.type === "response.completed" || event.type === "response.failed"
      ? { outcome: "unknown_response", responseId: event.responseId }
      : { outcome: "already_claimed", responseId: event.responseId };
  }

  const response = await dependencies.provider.retrieveBackgroundJson(
    event.responseId
  );
  await dispatchProviderResponse(
    job,
    response,
    dependencies.resultHandler,
    dependencies.repository
  );

  return {
    outcome: "processed",
    responseId: event.responseId,
    status: response.status
  };
}
