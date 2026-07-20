import { randomUUID } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/admin";
import { jsonError } from "@/server/api/envelope";
import {
  createProductEventRecorder,
  type ProductEventRpcClient
} from "@/server/product-events";
import {
  handleGetProfile,
  handlePutProfile,
  type ProfileSupabaseClient
} from "@/server/profiles/profileApi";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    return handleGetProfile(supabase as unknown as ProfileSupabaseClient);
  } catch {
    return jsonError("UNAUTHENTICATED", "Authentication is required.", randomUUID(), 401);
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const authoritativeSupabase = createServiceRoleSupabaseClient();
    return handlePutProfile(
      request,
      supabase as unknown as ProfileSupabaseClient,
      createProductEventRecorder(
        authoritativeSupabase as unknown as ProductEventRpcClient
      )
    );
  } catch {
    return jsonError("UNAUTHENTICATED", "Authentication is required.", randomUUID(), 401);
  }
}
