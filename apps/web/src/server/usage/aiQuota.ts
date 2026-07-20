type SupabaseError = { message: string };

export type SupabaseAiQuotaClient = {
  rpc(
    functionName: "consume_ai_quota",
    parameters: { p_idempotency_key: string }
  ): Promise<{ data: unknown; error: SupabaseError | null }>;
};

type QuotaRpcResult = {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  resets_on: string;
};

export function createSupabaseAiQuotaConsumer(client: SupabaseAiQuotaClient) {
  return async (_userId: string, idempotencyKey: string) => {
    const { data, error } = await client.rpc("consume_ai_quota", {
      p_idempotency_key: idempotencyKey
    });
    if (error) throw new Error(error.message);
    if (!isQuotaResult(data)) {
      throw new Error("consume_ai_quota returned an invalid payload.");
    }
    return {
      allowed: data.allowed,
      used: data.used,
      remaining: data.remaining,
      limit: data.limit,
      resetsOn: data.resets_on
    };
  };
}

function isQuotaResult(value: unknown): value is QuotaRpcResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<QuotaRpcResult>;
  return (
    typeof result.allowed === "boolean" &&
    typeof result.used === "number" &&
    typeof result.remaining === "number" &&
    typeof result.limit === "number" &&
    typeof result.resets_on === "string"
  );
}
