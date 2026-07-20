import { toAttemptDto } from "@/server/attempts/attemptDto";
import {
  toProcessingAttemptResultDto,
  toAttemptResultDto,
  toFailedAttemptResultDto
} from "@/server/attempts/attemptResultDto";
import { runAiCoachPipeline } from "@/server/ai/pipeline";
import type {
  PipelineInput,
  PipelineProfileContext
} from "@/server/ai/pipeline";
import {
  MAX_ANSWER_LENGTH,
  MINIMUM_ANSWER_MESSAGE,
  validateMinimumAnswer
} from "@/lib/validation/answer";
import type {
  AttemptDto,
  AttemptResultDto,
  AttemptRepository,
  AttemptRow
} from "@/server/attempts/types";
import type { TrainingDayNumber } from "@/server/questions";

export type AttemptErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "COURSE_COMPLETED"
  | "DATABASE_ERROR"
  | "QUOTA_EXCEEDED"
  | "INTERNAL_ERROR";

export class AttemptServiceError extends Error {
  code: AttemptErrorCode;
  status: number;
  details: Record<string, unknown>;

  constructor(
    code: AttemptErrorCode,
    message: string,
    status: number,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "AttemptServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export type SubmitAttemptInput = {
  userId: string;
  questionId: unknown;
  answerText: unknown;
  idempotencyKey: string | null;
  clientStartedAt?: unknown;
};

export type AttemptService = {
  submitAttempt: (input: SubmitAttemptInput) => Promise<AttemptDto>;
  getAttemptResult: (
    userId: string,
    attemptId: string
  ) => Promise<AttemptResultDto>;
};

export type AttemptTrainingProgress = {
  currentDay: TrainingDayNumber;
  isComplete: boolean;
};

type AttemptServiceDependencies = {
  repository: AttemptRepository;
  currentDayResolver?: (
    userId: string
  ) => Promise<TrainingDayNumber | AttemptTrainingProgress>;
  profileContextResolver?: (
    userId: string
  ) => Promise<PipelineProfileContext | undefined>;
  consumeAiQuota?: (userId: string, idempotencyKey: string) => Promise<{
    allowed: boolean;
    used: number;
    remaining: number;
    limit: number;
    resetsOn: string;
  }>;
  processAttempt?: (input: PipelineInput) => Promise<AttemptRow>;
  deferInFlightAttempts?: boolean;
  /**
   * Failed submissions are idempotent terminal responses by default. Controlled
   * revision recovery opts in and is bounded by the durable AI Job retry policy.
   */
  retryFailedAttempts?: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAttemptService({
  repository,
  currentDayResolver = async () => 1,
  profileContextResolver = async () => undefined,
  consumeAiQuota,
  processAttempt = runAiCoachPipeline,
  deferInFlightAttempts = false,
  retryFailedAttempts = false
}: AttemptServiceDependencies): AttemptService {
  return {
    async submitAttempt(input) {
      const validated = validateSubmitAttemptInput(input);

      const existingAttempt = await readFromRepository(() =>
        repository.findAttemptByIdempotencyKey(
          validated.userId,
          validated.idempotencyKey
        )
      );

      if (existingAttempt) {
        if (existingAttempt.status === "completed") {
          return toAttemptDto(existingAttempt);
        }

        if (existingAttempt.status === "failed" && !retryFailedAttempts) {
          return toAttemptDto(existingAttempt);
        }

        if (
          deferInFlightAttempts &&
          existingAttempt.status !== "submitted" &&
          existingAttempt.status !== "failed"
        ) {
          return toAttemptDto(existingAttempt);
        }

        const existingQuestion = await readFromRepository(() =>
          repository.findActiveQuestionById(existingAttempt.question_id)
        );

        if (!existingQuestion) {
          throw new AttemptServiceError(
            "NOT_FOUND",
            "Question was not found.",
            404,
            {
              question_id: existingAttempt.question_id
            }
          );
        }

        return toAttemptDto(
          await processAttempt({
            userId: validated.userId,
            attempt: existingAttempt,
            question: existingQuestion,
            repository,
            profileContext: await readFromRepository(() =>
              profileContextResolver(validated.userId)
            )
          })
        );
      }

      const question = await readFromRepository(() =>
        repository.findActiveQuestionById(validated.questionId)
      );

      if (!question) {
        throw new AttemptServiceError(
          "NOT_FOUND",
          "Question was not found.",
          404,
          {
            question_id: validated.questionId
          }
        );
      }

      if (!question.is_active) {
        throw new AttemptServiceError(
          "FORBIDDEN",
          "Question is not active.",
          403,
          {
            question_id: validated.questionId
          }
        );
      }

      const resolvedProgress = await readFromRepository(() =>
        currentDayResolver(validated.userId)
      );
      const progress = normalizeTrainingProgress(resolvedProgress);

      if (progress.isComplete) {
        throw new AttemptServiceError(
          "COURSE_COMPLETED",
          "The seven-day course is already completed.",
          409,
          {
            current_day: progress.currentDay
          }
        );
      }

      if (question.day_number !== progress.currentDay) {
        throw new AttemptServiceError(
          "FORBIDDEN",
          "Only the current training question can be submitted.",
          403,
          {
            current_day: progress.currentDay,
            question_day: question.day_number
          }
        );
      }

      if (consumeAiQuota) {
        const quota = await readFromRepository(() =>
          consumeAiQuota(validated.userId, validated.idempotencyKey)
        );
        if (!quota.allowed) {
          throw new AttemptServiceError(
            "QUOTA_EXCEEDED",
            "Daily AI training limit reached.",
            429,
            {
              used: quota.used,
              limit: quota.limit,
              remaining: quota.remaining,
              resets_on: quota.resetsOn
            }
          );
        }
      }

      const attempt = await readFromRepository(() =>
        repository.createAttempt({
          userId: validated.userId,
          questionId: validated.questionId,
          answerText: validated.answerText,
          idempotencyKey: validated.idempotencyKey,
          clientStartedAt: validated.clientStartedAt
        })
      );

      return toAttemptDto(
        await processAttempt({
          userId: validated.userId,
          attempt,
          question,
          repository,
          profileContext: await readFromRepository(() =>
            profileContextResolver(validated.userId)
          )
        })
      );
    },

    async getAttemptResult(userId, attemptId) {
      const attempt = await readFromRepository(() =>
        repository.findAttemptById(userId, attemptId)
      );

      if (!attempt) {
        throw new AttemptServiceError(
          "NOT_FOUND",
          "Attempt result was not found.",
          404,
          {
            attempt_id: attemptId
          }
        );
      }

      if (attempt.status === "failed") {
        return toFailedAttemptResultDto({
          attempt
        });
      }

      if (attempt.status !== "completed") {
        return toProcessingAttemptResultDto({ attempt });
      }

      const [score, feedback, sessionId] = await Promise.all([
        readFromRepository(() => repository.findScoreByAttemptId(attempt.id)),
        readFromRepository(() => repository.findAiFeedbackByAttemptId(attempt.id)),
        repository.findTrainingSessionIdByInitialAttemptId
          ? readFromRepository(() =>
              repository.findTrainingSessionIdByInitialAttemptId!(
                userId,
                attempt.id
              )
            )
          : Promise.resolve(null)
      ]);

      if (!score || !feedback) {
        throw new AttemptServiceError(
          "NOT_FOUND",
          "Attempt result was not found.",
          404,
          {
            attempt_id: attemptId
          }
        );
      }

      return toAttemptResultDto({
        attempt,
        score,
        feedback,
        sessionId
      });
    }
  };
}

function normalizeTrainingProgress(
  value: TrainingDayNumber | AttemptTrainingProgress
): AttemptTrainingProgress {
  return typeof value === "number"
    ? { currentDay: value, isComplete: false }
    : value;
}

function validateSubmitAttemptInput(input: SubmitAttemptInput) {
  if (typeof input.questionId !== "string" || !UUID_PATTERN.test(input.questionId)) {
    throw new AttemptServiceError(
      "VALIDATION_ERROR",
      "question_id must be a valid UUID.",
      400,
      {
        field: "question_id"
      }
    );
  }

  if (typeof input.answerText !== "string") {
    throw new AttemptServiceError(
      "VALIDATION_ERROR",
      "answer_text is required.",
      400,
      {
        field: "answer_text"
      }
    );
  }

  const answerText = input.answerText.trim();

  const minimumAnswerValidation = validateMinimumAnswer(answerText);

  if (!minimumAnswerValidation.ok) {
    throw new AttemptServiceError(
      "VALIDATION_ERROR",
      minimumAnswerValidation.message === "Please enter an answer before submitting."
        ? "answer_text cannot be empty."
        : MINIMUM_ANSWER_MESSAGE,
      400,
      {
        field: "answer_text"
      }
    );
  }

  if (answerText.length > MAX_ANSWER_LENGTH) {
    throw new AttemptServiceError(
      "VALIDATION_ERROR",
      "answer_text must be 6000 characters or fewer.",
      400,
      {
        field: "answer_text",
        max: MAX_ANSWER_LENGTH
      }
    );
  }

  const idempotencyKey = input.idempotencyKey?.trim();

  if (!idempotencyKey) {
    throw new AttemptServiceError(
      "VALIDATION_ERROR",
      "X-Idempotency-Key header is required.",
      400,
      {
        header: "X-Idempotency-Key"
      }
    );
  }

  let clientStartedAt: string | null = null;

  if (input.clientStartedAt !== undefined && input.clientStartedAt !== null) {
    if (
      typeof input.clientStartedAt !== "string" ||
      Number.isNaN(Date.parse(input.clientStartedAt))
    ) {
      throw new AttemptServiceError(
        "VALIDATION_ERROR",
        "client_started_at must be an ISO-8601 datetime.",
        400,
        {
          field: "client_started_at"
        }
      );
    }

    clientStartedAt = input.clientStartedAt;
  }

  return {
    userId: input.userId,
    questionId: input.questionId,
    answerText,
    idempotencyKey,
    clientStartedAt
  };
}

async function readFromRepository<TResult>(
  read: () => Promise<TResult>
): Promise<TResult> {
  try {
    return await read();
  } catch (error) {
    throw new AttemptServiceError(
      "DATABASE_ERROR",
      "Unable to save attempt.",
      500,
      {
        cause: error instanceof Error ? error.message : "Unknown repository error"
      }
    );
  }
}
