import { logger } from "@/server/observability/logger";
import {
  ProductEventInputSchema,
  ProductEventUserIdSchema,
  type ProductEventRecordInput
} from "@/server/product-events/types";

type SupabaseError = { code?: string; message: string };
type RpcResult = Promise<{ data: unknown; error: SupabaseError | null }>;

export type ProductEventRpcClient = {
  rpc(
    name: "record_product_event",
    args: Record<string, unknown>
  ): RpcResult;
};

export type ProductEventRecorder = (
  input: ProductEventRecordInput
) => Promise<void>;

export function createProductEventRecorder(
  client: ProductEventRpcClient
): ProductEventRecorder {
  return async (input) => {
    const {
      userId: unverifiedUserId,
      request_id: requestId,
      ...eventInput
    } = input;
    const userId = ProductEventUserIdSchema.parse(unverifiedUserId);
    const parsed = ProductEventInputSchema.parse(eventInput);
    const { error } = await client.rpc("record_product_event", {
      p_user_id: userId,
      p_event_name: parsed.event_name,
      p_session_id: "session_id" in parsed ? parsed.session_id ?? null : null,
      p_attempt_id: "attempt_id" in parsed ? parsed.attempt_id ?? null : null,
      p_metadata: parsed.metadata,
      p_request_id: requestId?.trim() || null
    });

    if (error) {
      const persistenceError = new Error("Product event persistence failed.");
      (persistenceError as Error & { code?: string }).code = error.code;
      throw persistenceError;
    }
  };
}

export async function recordProductEventBestEffort(
  recorder: ProductEventRecorder | undefined,
  input: ProductEventRecordInput,
  operation: string
) {
  if (!recorder) return false;

  try {
    await recorder(input);
    return true;
  } catch (error) {
    logger.warn("Product event was not recorded.", {
      operation,
      eventName: input.event_name,
      requestId: input.request_id,
      error
    });
    return false;
  }
}
