import type {
  PracticeSessionRow,
  PracticeSessionStatus,
  RevisionAction,
  RevisionEventRow
} from "@/server/training-sessions/types";

export type CreatePracticeSessionInput = {
  userId: string;
  initialAttemptId: string;
  idempotencyKey: string;
  practiceDay: number;
  feedbackShownAt: string | null;
  createdAt: string;
};

export type CommitRevisionRepositoryInput = {
  userId: string;
  sessionId: string;
  idempotencyKey: string;
  action: RevisionAction;
  editedText: string | null;
  clientDecidedAt: string;
};

export type CommitRevisionRepositoryOutcome = {
  outcome: "committed" | "replayed" | "retry_claimed" | "conflict" | "not_found";
  sessionId: string;
  revisionEventId?: string;
  finalAttemptId?: string;
  status?: PracticeSessionStatus;
};

export type TrainingSessionRepository = {
  findById: (
    userId: string,
    sessionId: string
  ) => Promise<PracticeSessionRow | null>;
  findByInitialAttemptId: (
    userId: string,
    initialAttemptId: string
  ) => Promise<PracticeSessionRow | null>;
  findByIdempotencyKey: (
    userId: string,
    idempotencyKey: string
  ) => Promise<PracticeSessionRow | null>;
  create: (input: CreatePracticeSessionInput) => Promise<PracticeSessionRow>;
  findRevision: (
    userId: string,
    sessionId: string
  ) => Promise<RevisionEventRow | null>;
  commitRevision: (
    input: CommitRevisionRepositoryInput
  ) => Promise<CommitRevisionRepositoryOutcome>;
  setRescoreOutcome: (
    userId: string,
    sessionId: string,
    status: "completed" | "rescore_failed"
  ) => Promise<void>;
  markFeedbackViewed?: (
    userId: string,
    sessionId: string
  ) => Promise<string>;
};

type SupabaseError = {
  code?: string;
  message: string;
};

type QueryResult<T> = Promise<{
  data: T | null;
  error: SupabaseError | null;
}>;

type FilterBuilder<T> = {
  eq: (column: string, value: unknown) => FilterBuilder<T>;
  maybeSingle: () => QueryResult<T>;
};

type InsertBuilder<T> = {
  select: (columns: string) => {
    single: () => QueryResult<T>;
  };
};

export type SupabaseTrainingSessionClient = {
  from: (table: string) => {
    select: (columns: string) => FilterBuilder<unknown>;
    insert: (values: Record<string, unknown>) => InsertBuilder<unknown>;
  };
  rpc: (
    functionName: string,
    args: Record<string, unknown>
  ) => QueryResult<unknown>;
};

const sessionColumns =
  "id, user_id, initial_attempt_id, final_attempt_id, idempotency_key, practice_day, feedback_mode, feedback_shown_at, status, created_at, completed_at";
const revisionColumns =
  "id, session_id, idempotency_key, action, edited_text, client_decided_at, created_at";

export function createSupabaseTrainingSessionRepository(
  supabase: SupabaseTrainingSessionClient
): TrainingSessionRepository {
  return {
    async findById(userId, sessionId) {
      return findSession(supabase, userId, "id", sessionId);
    },

    async findByInitialAttemptId(userId, initialAttemptId) {
      return findSession(
        supabase,
        userId,
        "initial_attempt_id",
        initialAttemptId
      );
    },

    async findByIdempotencyKey(userId, idempotencyKey) {
      return findSession(
        supabase,
        userId,
        "idempotency_key",
        idempotencyKey
      );
    },

    async create(input) {
      const query = supabase
        .from("practice_sessions")
        .insert({
          user_id: input.userId,
          initial_attempt_id: input.initialAttemptId,
          final_attempt_id: null,
          idempotency_key: input.idempotencyKey,
          practice_day: input.practiceDay,
          feedback_mode: "D",
          feedback_shown_at: input.feedbackShownAt,
          status: "feedback_ready",
          created_at: input.createdAt,
          completed_at: null
        })
        .select(sessionColumns) as {
        single: () => QueryResult<PracticeSessionRow>;
      };
      const { data, error } = await query.single();
      ensureNoError(error);
      if (!data) throw new Error("Practice session insert returned no row.");
      return data;
    },

    async findRevision(_userId, sessionId) {
      const query = supabase
        .from("revision_events")
        .select(revisionColumns)
        .eq("session_id", sessionId) as FilterBuilder<RevisionEventRow>;
      const { data, error } = await query.maybeSingle();
      ensureNoError(error);
      return data;
    },

    async commitRevision(input) {
      const { data, error } = await supabase.rpc("commit_revision_event", {
        p_session_id: input.sessionId,
        p_idempotency_key: input.idempotencyKey,
        p_action: input.action,
        p_edited_text: input.editedText,
        p_client_decided_at: input.clientDecidedAt
      });
      ensureNoError(error);
      return mapCommitOutcome(data);
    },

    async setRescoreOutcome(_userId, sessionId, status) {
      const { error } = await supabase.rpc("set_revision_rescore_outcome", {
        p_session_id: sessionId,
        p_status: status
      });
      ensureNoError(error);
    },

    async markFeedbackViewed(_userId, sessionId) {
      const { data, error } = await supabase.rpc(
        "mark_training_session_feedback_viewed",
        { p_session_id: sessionId }
      );
      ensureNoError(error);
      if (typeof data !== "string") {
        throw new Error("Feedback viewed function returned an invalid timestamp.");
      }
      return data;
    }
  };
}

async function findSession(
  supabase: SupabaseTrainingSessionClient,
  userId: string,
  column: "id" | "initial_attempt_id" | "idempotency_key",
  value: string
) {
  const query = supabase
    .from("practice_sessions")
    .select(sessionColumns)
    .eq("user_id", userId) as FilterBuilder<PracticeSessionRow>;
  const { data, error } = await query.eq(column, value).maybeSingle();
  ensureNoError(error);
  return data;
}

function mapCommitOutcome(value: unknown): CommitRevisionRepositoryOutcome {
  if (!isRecord(value) || typeof value.outcome !== "string") {
    throw new Error("Revision function returned an invalid outcome.");
  }
  if (
    !["committed", "replayed", "retry_claimed", "conflict", "not_found"].includes(
      value.outcome
    ) ||
    typeof value.session_id !== "string"
  ) {
    throw new Error("Revision function returned an unsupported outcome.");
  }
  return {
    outcome: value.outcome as CommitRevisionRepositoryOutcome["outcome"],
    sessionId: value.session_id,
    revisionEventId:
      typeof value.revision_event_id === "string"
        ? value.revision_event_id
        : undefined,
    finalAttemptId:
      typeof value.final_attempt_id === "string"
        ? value.final_attempt_id
        : undefined,
    status: isPracticeSessionStatus(value.status) ? value.status : undefined
  };
}

function isPracticeSessionStatus(value: unknown): value is PracticeSessionStatus {
  return (
    typeof value === "string" &&
    ["feedback_ready", "rescoring", "rescore_failed", "completed"].includes(
      value
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureNoError(error: SupabaseError | null) {
  if (error) throw new Error(error.message);
}
