import { createClient } from "@supabase/supabase-js";

type LiveAttemptVerificationEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type VerificationAttempt = Record<string, unknown> & {
  id: string;
  status: string;
  analysis_prompt_version: string | null;
  coaching_prompt_version: string | null;
  ai_model: string | null;
  repair_count: number | null;
  analysis_latency_ms: number | null;
  coaching_latency_ms: number | null;
  total_latency_ms: number | null;
};

type VerificationScore = Record<string, unknown> & {
  attempt_id: string;
  total_score: number;
};

type VerificationFeedback = Record<string, unknown> & {
  attempt_id: string;
  observable_features: Record<string, unknown> | null;
  safety_flags: Array<Record<string, unknown>> | null;
};

export type LiveAttemptVerificationSource = {
  findAttempt: (attemptId: string) => Promise<VerificationAttempt | null>;
  findScore: (attemptId: string) => Promise<VerificationScore | null>;
  findFeedback: (attemptId: string) => Promise<VerificationFeedback | null>;
};

type CommandOutput = {
  write: (line: string) => void;
};

export async function runLiveAttemptVerificationCommand({
  args,
  env,
  source,
  output
}: {
  args: string[];
  env: LiveAttemptVerificationEnv;
  source?: LiveAttemptVerificationSource;
  output: CommandOutput;
}): Promise<number> {
  try {
    const attemptId = parseAttemptId(args);
    validateVerificationEnvironment(env);
    const verificationSource =
      source ?? createSupabaseVerificationSource(env);
    const [attempt, score, feedback] = await Promise.all([
      verificationSource.findAttempt(attemptId),
      verificationSource.findScore(attemptId),
      verificationSource.findFeedback(attemptId)
    ]);

    if (!attempt) {
      throw new Error("Attempt was not found.");
    }

    const summary = {
      attempt_id: attempt.id,
      attempt_status: attempt.status,
      analysis_prompt_version: attempt.analysis_prompt_version,
      coaching_prompt_version: attempt.coaching_prompt_version,
      ai_model: attempt.ai_model,
      repair_count: attempt.repair_count ?? 0,
      latency_ms: {
        analysis: attempt.analysis_latency_ms,
        coaching: attempt.coaching_latency_ms,
        total: attempt.total_latency_ms
      },
      scores_exists: Boolean(score),
      ai_feedback_exists: Boolean(feedback),
      observable_features_exists: Boolean(feedback?.observable_features),
      safety_flags_exists: Array.isArray(feedback?.safety_flags),
      verification_status:
        attempt.status === "completed" &&
        Boolean(score) &&
        Boolean(feedback) &&
        Boolean(feedback?.observable_features) &&
        Array.isArray(feedback?.safety_flags)
          ? "passed"
          : "failed"
    };

    output.write(JSON.stringify(summary, null, 2));
    return summary.verification_status === "passed" ? 0 : 1;
  } catch (error) {
    output.write(
      `Live attempt verification failed: ${sanitizeVerificationError(error, env)}`
    );
    return 1;
  }
}

function parseAttemptId(args: string[]) {
  if (args.length !== 1 || !isUuid(args[0])) {
    throw new Error("Usage: npm run verify:live-attempt -- <attemptId UUID>");
  }

  return args[0];
}

function validateVerificationEnvironment(
  env: LiveAttemptVerificationEnv
): asserts env is Required<LiveAttemptVerificationEnv> {
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required.");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }
}

function createSupabaseVerificationSource(
  env: Required<LiveAttemptVerificationEnv>
): LiveAttemptVerificationSource {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return {
    async findAttempt(attemptId) {
      const { data, error } = await supabase
        .from("attempts")
        .select(
          "id, status, analysis_prompt_version, coaching_prompt_version, ai_model, repair_count, analysis_latency_ms, coaching_latency_ms, total_latency_ms"
        )
        .eq("id", attemptId)
        .maybeSingle();
      throwOnSupabaseError(error);
      return data as VerificationAttempt | null;
    },
    async findScore(attemptId) {
      const { data, error } = await supabase
        .from("scores")
        .select("attempt_id, total_score")
        .eq("attempt_id", attemptId)
        .maybeSingle();
      throwOnSupabaseError(error);
      return data as VerificationScore | null;
    },
    async findFeedback(attemptId) {
      const { data, error } = await supabase
        .from("ai_feedback")
        .select("attempt_id, observable_features, safety_flags")
        .eq("attempt_id", attemptId)
        .maybeSingle();
      throwOnSupabaseError(error);
      return data as VerificationFeedback | null;
    }
  };
}

function throwOnSupabaseError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function sanitizeVerificationError(
  error: unknown,
  env: LiveAttemptVerificationEnv
) {
  let message =
    error instanceof Error ? error.message : "Unknown verification error.";

  for (const secret of [
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_URL
  ]) {
    if (secret) {
      message = message.replaceAll(secret, "[REDACTED]");
    }
  }

  return message.slice(0, 500);
}

function isUuid(value: string | undefined) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}
