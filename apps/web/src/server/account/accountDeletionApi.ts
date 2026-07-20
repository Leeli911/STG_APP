import { randomUUID } from "node:crypto";

import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { jsonError, jsonSuccess } from "@/server/api/envelope";
import { logger } from "@/server/observability/logger";

type SupabaseError = { message: string };
type SupabaseResult<T = unknown> = Promise<{
  data: T | null;
  error: SupabaseError | null;
}>;

export type AccountDeletionUserClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error?: SupabaseError | null;
    }>;
    signOut(): SupabaseResult;
  };
  rpc(
    name: "delete_my_training_data",
    args?: Record<string, never>
  ): SupabaseResult;
};

export type AccountDeletionAdminClient = {
  auth: {
    admin: {
      deleteUser(userId: string): SupabaseResult;
    };
  };
};

export type AccountDeletionAdminClientFactory =
  () => AccountDeletionAdminClient;

export async function handleDeleteAccount(
  client: AccountDeletionUserClient,
  createAdminClient: AccountDeletionAdminClientFactory =
    createServiceRoleSupabaseClient
) {
  const requestId = randomUUID();
  const user = await readCurrentUser(client);

  if (!user) {
    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    );
  }

  let adminClient: AccountDeletionAdminClient;
  try {
    // Resolve the authoritative client before deleting any data. Missing
    // service-role configuration therefore fails closed without a partial
    // deletion.
    adminClient = createAdminClient();
  } catch (error) {
    logger.error("Account deletion is unavailable.", {
      requestId,
      route: "/api/me/account",
      error
    });
    return noStore(
      jsonError(
        "ACCOUNT_DELETION_UNAVAILABLE",
        "Account deletion is unavailable in this environment.",
        requestId,
        503
      )
    );
  }

  try {
    // This ownership RPC takes no user id and derives its target exclusively
    // from auth.uid() on the current user's Supabase session.
    const { error } = await client.rpc("delete_my_training_data", {});
    if (error) throw new Error(error.message);
  } catch (error) {
    logger.error("Account training-data deletion failed.", {
      requestId,
      route: "/api/me/account",
      error
    });
    return noStore(
      jsonError(
        "DATABASE_ERROR",
        "Unable to delete account data.",
        requestId,
        500
      )
    );
  }

  try {
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);
  } catch (error) {
    logger.error("Auth account deletion failed after data deletion.", {
      requestId,
      route: "/api/me/account",
      error
    });
    return noStore(
      jsonError(
        "TRAINING_DATA_DELETED_ACCOUNT_DELETE_FAILED",
        "Training data was deleted, but the account could not be deleted.",
        requestId,
        500,
        {
          trainingDataDeleted: true,
          accountDeleted: false
        }
      )
    );
  }

  try {
    const { error } = await client.auth.signOut();
    if (error) throw new Error(error.message);
  } catch (error) {
    logger.error("Session sign-out failed after account deletion.", {
      requestId,
      route: "/api/me/account",
      error
    });
    return clearBrowserSession(
      jsonError(
        "ACCOUNT_DELETED_SIGN_OUT_FAILED",
        "The account was deleted, but server sign-out could not be confirmed.",
        requestId,
        500,
        {
          trainingDataDeleted: true,
          accountDeleted: true
        }
      )
    );
  }

  return clearBrowserSession(
    jsonSuccess(
      {
        trainingDataDeleted: true,
        accountDeleted: true,
        signedOut: true
      },
      requestId
    )
  );
}

async function readCurrentUser(client: AccountDeletionUserClient) {
  try {
    const { data, error } = await client.auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}

function noStore(response: Response) {
  response.headers.set("cache-control", "no-store");
  return response;
}

function clearBrowserSession(response: Response) {
  noStore(response);
  response.headers.set(
    "clear-site-data",
    '"cache", "cookies", "storage"'
  );
  return response;
}
