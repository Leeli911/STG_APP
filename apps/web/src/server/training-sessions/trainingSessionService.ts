import { validateRevisionDecision } from "@/lib/validation/revision";
import {
  createAttemptService,
  type SubmitAttemptInput
} from "@/server/attempts/attemptService";
import type {
  AttemptDto,
  AttemptRepository,
  AttemptRow
} from "@/server/attempts/types";
import type {
  PipelineInput,
  PipelineProfileContext
} from "@/server/ai/pipeline";
import { runAiRescorePipeline } from "@/server/ai/pipeline";
import { toTrainingSessionDto } from "@/server/training-sessions/trainingSessionDto";
import type {
  TrainingSessionRepository
} from "@/server/training-sessions/trainingSessionRepository";
import type { TrainingSessionDto } from "@/server/training-sessions/types";
import {
  recordProductEventBestEffort,
  type ProductEventRecorder
} from "@/server/product-events";

export type TrainingSessionServiceErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "ATTEMPT_NOT_READY"
  | "ATTEMPT_RESULT_NOT_READY"
  | "IDEMPOTENCY_KEY_REUSED"
  | "REVISION_ALREADY_COMMITTED"
  | "SESSION_DATA_INCOMPLETE"
  | "RESCORE_FAILED"
  | "DATABASE_ERROR";

export class TrainingSessionServiceError extends Error {
  constructor(
    readonly code: TrainingSessionServiceErrorCode,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "TrainingSessionServiceError";
  }
}

export type AttemptSubmissionService = {
  submitAttempt: (input: SubmitAttemptInput) => Promise<AttemptDto>;
};

export type AttemptServiceFactory = (
  practiceDay: number
) => AttemptSubmissionService;

export type TrainingSessionService = {
  createSession(input: {
    userId: string;
    initialAttemptId: unknown;
    idempotencyKey: string | null;
  }): Promise<TrainingSessionDto>;
  getSession(userId: string, sessionId: string): Promise<TrainingSessionDto>;
  markFeedbackViewed(
    userId: string,
    sessionId: string
  ): Promise<TrainingSessionDto>;
  commitRevision(input: {
    userId: string;
    sessionId: string;
    idempotencyKey: string | null;
    action: unknown;
    editedText: unknown;
    clientDecidedAt: unknown;
  }): Promise<{ session: TrainingSessionDto; httpStatus: 200 | 202 }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createTrainingSessionService({
  sessionRepository,
  attemptRepository,
  profileContextResolver = async () => undefined,
  processRescoreAttempt = runAiRescorePipeline,
  deferRescore = false,
  attemptServiceFactory = (practiceDay) =>
    createAttemptService({
      repository: attemptRepository,
      currentDayResolver: async () => practiceDay as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      profileContextResolver,
      processAttempt: processRescoreAttempt,
      deferInFlightAttempts: deferRescore,
      retryFailedAttempts: true
    }),
  now = () => new Date().toISOString(),
  recordProductEvent
}: {
  sessionRepository: TrainingSessionRepository;
  attemptRepository: AttemptRepository;
  profileContextResolver?: (
    userId: string
  ) => Promise<PipelineProfileContext | undefined>;
  processRescoreAttempt?: (
    input: PipelineInput
  ) => Promise<AttemptRow>;
  deferRescore?: boolean;
  attemptServiceFactory?: AttemptServiceFactory;
  now?: () => string;
  recordProductEvent?: ProductEventRecorder;
}): TrainingSessionService {
  async function getSession(
    userId: string,
    sessionId: string
  ): Promise<TrainingSessionDto> {
    const session = await read(() => sessionRepository.findById(userId, sessionId));
    if (!session) {
      throw new TrainingSessionServiceError(
        "NOT_FOUND",
        "Training session was not found.",
        404,
        { session_id: sessionId }
      );
    }

    const [initialAttempt, initialScore, initialFeedback, revision] =
      await Promise.all([
        read(() =>
          attemptRepository.findAttemptById(userId, session.initial_attempt_id)
        ),
        read(() =>
          attemptRepository.findScoreByAttemptId(session.initial_attempt_id)
        ),
        read(() =>
          attemptRepository.findAiFeedbackByAttemptId(session.initial_attempt_id)
        ),
        read(() => sessionRepository.findRevision(userId, session.id))
      ]);

    if (!initialAttempt || !initialScore || !initialFeedback) {
      throw new TrainingSessionServiceError(
        "SESSION_DATA_INCOMPLETE",
        "Training session is missing its initial result.",
        500,
        { session_id: session.id }
      );
    }

    let finalAttempt = null;
    let finalScore = null;
    let finalFeedback = null;
    if (session.final_attempt_id) {
      [finalAttempt, finalScore, finalFeedback] = await Promise.all([
        read(() =>
          attemptRepository.findAttemptById(userId, session.final_attempt_id!)
        ),
        session.status === "completed"
          ? read(() =>
              attemptRepository.findScoreByAttemptId(session.final_attempt_id!)
            )
          : Promise.resolve(null),
        session.status === "completed"
          ? read(() =>
              attemptRepository.findAiFeedbackByAttemptId(
                session.final_attempt_id!
              )
            )
          : Promise.resolve(null)
      ]);
    }

    try {
      return toTrainingSessionDto({
        session,
        revision,
        initialAttempt,
        initialScore,
        initialFeedback,
        finalAttempt,
        finalScore,
        finalFeedback
      });
    } catch (error) {
      throw new TrainingSessionServiceError(
        "SESSION_DATA_INCOMPLETE",
        "Training session data is incomplete.",
        500,
        {
          session_id: session.id,
          cause: error instanceof Error ? error.message : "Unknown mapper error"
        }
      );
    }
  }

  return {
    async createSession(input) {
      const validated = validateCreateSessionInput(input);
      const existingByKey = await read(() =>
        sessionRepository.findByIdempotencyKey(
          validated.userId,
          validated.idempotencyKey
        )
      );
      if (existingByKey) {
        if (existingByKey.initial_attempt_id !== validated.initialAttemptId) {
          throw new TrainingSessionServiceError(
            "IDEMPOTENCY_KEY_REUSED",
            "Idempotency key was already used for another attempt.",
            409
          );
        }
        return getSession(validated.userId, existingByKey.id);
      }

      const existingByAttempt = await read(() =>
        sessionRepository.findByInitialAttemptId(
          validated.userId,
          validated.initialAttemptId
        )
      );
      if (existingByAttempt) {
        return getSession(validated.userId, existingByAttempt.id);
      }

      const initialAttempt = await read(() =>
        attemptRepository.findAttemptById(
          validated.userId,
          validated.initialAttemptId
        )
      );
      if (!initialAttempt) {
        throw new TrainingSessionServiceError(
          "NOT_FOUND",
          "Initial attempt was not found.",
          404
        );
      }
      if (initialAttempt.status !== "completed") {
        throw new TrainingSessionServiceError(
          "ATTEMPT_NOT_READY",
          "Initial attempt is not completed.",
          409
        );
      }

      const [score, feedback] = await Promise.all([
        read(() => attemptRepository.findScoreByAttemptId(initialAttempt.id)),
        read(() => attemptRepository.findAiFeedbackByAttemptId(initialAttempt.id))
      ]);
      if (!score || !feedback) {
        throw new TrainingSessionServiceError(
          "ATTEMPT_RESULT_NOT_READY",
          "Initial attempt result is not ready.",
          409
        );
      }

      const createdAt = now();
      const created = await read(() =>
        sessionRepository.create({
          userId: validated.userId,
          initialAttemptId: initialAttempt.id,
          idempotencyKey: validated.idempotencyKey,
          practiceDay: initialAttempt.day_number,
          feedbackShownAt: null,
          createdAt
        })
      );
      return getSession(validated.userId, created.id);
    },

    getSession,

    async markFeedbackViewed(userId, sessionId) {
      if (!UUID_PATTERN.test(sessionId)) {
        throw new TrainingSessionServiceError(
          "VALIDATION_ERROR",
          "session_id must be a valid UUID.",
          400
        );
      }
      if (!sessionRepository.markFeedbackViewed) {
        throw new TrainingSessionServiceError(
          "DATABASE_ERROR",
          "Feedback viewed persistence is unavailable.",
          500
        );
      }
      const existing = await read(() =>
        sessionRepository.findById(userId, sessionId)
      );
      if (!existing) {
        throw new TrainingSessionServiceError(
          "NOT_FOUND",
          "Training session was not found.",
          404,
          { session_id: sessionId }
        );
      }
      await read(() => sessionRepository.markFeedbackViewed!(userId, sessionId));
      const viewed = await getSession(userId, sessionId);
      if (!existing.feedback_shown_at) {
        await recordProductEventBestEffort(
          recordProductEvent,
          {
            userId,
            event_name: "feedback_viewed",
            session_id: viewed.id,
            attempt_id: viewed.draft.attemptId,
            metadata: {
              practice_day: toPracticeDay(viewed.practiceDay),
              feedback_mode: "D"
            }
          },
          "training.feedback_viewed"
        );
      }
      return viewed;
    },

    async commitRevision(input) {
      const session = await read(() =>
        sessionRepository.findById(input.userId, input.sessionId)
      );
      if (!session) {
        throw new TrainingSessionServiceError(
          "NOT_FOUND",
          "Training session was not found.",
          404
        );
      }

      const [initialAttempt, initialFeedback] = await Promise.all([
        read(() =>
          attemptRepository.findAttemptById(
            input.userId,
            session.initial_attempt_id
          )
        ),
        read(() =>
          attemptRepository.findAiFeedbackByAttemptId(session.initial_attempt_id)
        )
      ]);
      if (!initialAttempt || !initialFeedback) {
        throw new TrainingSessionServiceError(
          "SESSION_DATA_INCOMPLETE",
          "Training session is missing revision source data.",
          500
        );
      }

      const validated = validateRevisionInput(
        input,
        initialAttempt,
        initialFeedback.rewrite.text
      );
      const outcome = await read(() =>
        sessionRepository.commitRevision({
          userId: input.userId,
          sessionId: session.id,
          idempotencyKey: validated.idempotencyKey,
          action: validated.action,
          editedText: validated.editedText,
          clientDecidedAt: validated.clientDecidedAt
        })
      );

      if (outcome.outcome === "not_found") {
        throw new TrainingSessionServiceError(
          "NOT_FOUND",
          "Training session was not found.",
          404
        );
      }
      if (outcome.outcome === "conflict") {
        throw new TrainingSessionServiceError(
          "REVISION_ALREADY_COMMITTED",
          "A different revision decision is already committed.",
          409,
          { session_id: session.id }
        );
      }
      if (outcome.outcome === "replayed") {
        const current = await getSession(input.userId, session.id);
        if (current.status !== "rescoring") {
          return {
            session: current,
            httpStatus: 200
          };
        }

        const finalAttempt = await read(() =>
          attemptRepository.findAttemptById(
            input.userId,
            outcome.finalAttemptId ?? current.final.attemptId
          )
        );
        if (!finalAttempt) {
          throw new TrainingSessionServiceError(
            "SESSION_DATA_INCOMPLETE",
            "Training session is missing its final attempt.",
            500,
            { session_id: session.id }
          );
        }

        // `submitted` is the durable crash window: the revision transaction
        // committed, but no AI Job was enqueued. Active states are already owned
        // by the Job/Webhook pipeline and must remain an idempotent 202 replay.
        if (finalAttempt.status !== "submitted") {
          return {
            session: current,
            httpStatus: 202
          };
        }
      }

      if (outcome.outcome === "committed") {
        await recordProductEventBestEffort(
          recordProductEvent,
          {
            userId: input.userId,
            event_name: "revision_committed",
            session_id: session.id,
            attempt_id: session.initial_attempt_id,
            metadata: {
              practice_day: toPracticeDay(session.practice_day),
              action: validated.action
            }
          },
          "training.revision_committed"
        );
      }

      if (validated.action === "rejected") {
        const completed = await getSession(input.userId, session.id);
        await recordCompletedTrainingEvents(
          recordProductEvent,
          input.userId,
          completed
        );
        return {
          session: completed,
          httpStatus: 200
        };
      }

      const finalAttemptKey = `revision:${session.id}`;
      const attemptService = attemptServiceFactory(session.practice_day);
      try {
        const rescoredAttempt = await attemptService.submitAttempt({
          userId: input.userId,
          questionId: initialAttempt.question_id,
          answerText: validated.finalText,
          idempotencyKey: finalAttemptKey,
          clientStartedAt: validated.clientDecidedAt
        });
        if (rescoredAttempt.status === "failed") {
          throw new Error(
            "Final answer re-score could not be enqueued or exhausted its retry limit."
          );
        }
        if (rescoredAttempt.status !== "completed") {
          return {
            session: await getSession(input.userId, session.id),
            httpStatus: 202
          };
        }
        await read(() =>
          sessionRepository.setRescoreOutcome(
            input.userId,
            session.id,
            "completed"
          )
        );
      } catch (error) {
        await read(() =>
          sessionRepository.setRescoreOutcome(
            input.userId,
            session.id,
            "rescore_failed"
          )
        );
        throw new TrainingSessionServiceError(
          "RESCORE_FAILED",
          "Final answer re-score failed.",
          502,
          {
            session_id: session.id,
            cause: error instanceof Error ? error.message : "Unknown re-score error"
          }
        );
      }

      const completed = await getSession(input.userId, session.id);
      await recordCompletedTrainingEvents(
        recordProductEvent,
        input.userId,
        completed
      );
      return {
        session: completed,
        httpStatus: 200
      };
    }
  };
}

async function recordCompletedTrainingEvents(
  recorder: ProductEventRecorder | undefined,
  userId: string,
  session: TrainingSessionDto
) {
  if (session.status !== "completed") return;
  const practiceDay = toPracticeDay(session.practiceDay);
  const scoreDelta = session.scoreAfter.total - session.scoreBefore.total;

  await recordProductEventBestEffort(
    recorder,
    {
      userId,
      event_name: "session_completed",
      session_id: session.id,
      attempt_id: session.final.attemptId,
      metadata: {
        practice_day: practiceDay,
        action: session.decision.action,
        score_delta: scoreDelta
      }
    },
    "training.session_completed"
  );
  await recordProductEventBestEffort(
    recorder,
    {
      userId,
      event_name: "day_completed",
      session_id: session.id,
      attempt_id: session.final.attemptId,
      metadata: {
        practice_day: practiceDay,
        curriculum_slug: "stg-7day-v1"
      }
    },
    "training.day_completed"
  );
}

function toPracticeDay(value: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return value as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

function validateCreateSessionInput(input: {
  userId: string;
  initialAttemptId: unknown;
  idempotencyKey: string | null;
}) {
  if (
    typeof input.initialAttemptId !== "string" ||
    !UUID_PATTERN.test(input.initialAttemptId)
  ) {
    throw new TrainingSessionServiceError(
      "VALIDATION_ERROR",
      "initial_attempt_id must be a valid UUID.",
      400
    );
  }
  const key = input.idempotencyKey?.trim();
  if (!key) {
    throw new TrainingSessionServiceError(
      "VALIDATION_ERROR",
      "Idempotency key is required.",
      400
    );
  }
  return {
    userId: input.userId,
    initialAttemptId: input.initialAttemptId,
    idempotencyKey: key
  };
}

function validateRevisionInput(
  input: {
    idempotencyKey: string | null;
    action: unknown;
    editedText: unknown;
    clientDecidedAt: unknown;
  },
  draft: AttemptRow,
  suggestionText: string
) {
  const key = input.idempotencyKey?.trim();
  if (!key) validationError("Idempotency key is required.");
  if (
    typeof input.clientDecidedAt !== "string" ||
    Number.isNaN(Date.parse(input.clientDecidedAt))
  ) {
    validationError("client_decided_at must be an ISO-8601 datetime.");
  }

  const decision = validateRevisionDecision({
    action: input.action,
    editedText: input.editedText,
    draftText: draft.original_answer,
    suggestionText
  });
  if (!decision.ok) validationError(decision.message);

  return {
    idempotencyKey: key!,
    ...decision.value,
    clientDecidedAt: input.clientDecidedAt as string
  };
}

function validationError(message: string): never {
  throw new TrainingSessionServiceError(
    "VALIDATION_ERROR",
    message,
    400
  );
}

async function read<TResult>(operation: () => Promise<TResult>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TrainingSessionServiceError) throw error;
    throw new TrainingSessionServiceError(
      "DATABASE_ERROR",
      "Training session persistence failed.",
      500,
      { cause: error instanceof Error ? error.message : "Unknown database error" }
    );
  }
}
