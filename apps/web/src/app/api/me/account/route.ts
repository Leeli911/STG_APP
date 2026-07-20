import { randomUUID } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { jsonError } from "@/server/api/envelope";
import {
  handleDeleteAccount,
  type AccountDeletionUserClient
} from "@/server/account/accountDeletionApi";
import { logger } from "@/server/observability/logger";

export async function DELETE() {
  try {
    const supabase = await createServerSupabaseClient();
    return handleDeleteAccount(
      supabase as unknown as AccountDeletionUserClient
    );
  } catch (error) {
    const requestId = randomUUID();
    logger.error("Account deletion route initialization failed.", {
      requestId,
      route: "/api/me/account",
      error
    });
    const response = jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    );
    response.headers.set("cache-control", "no-store");
    return response;
  }
}
