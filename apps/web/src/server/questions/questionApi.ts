import { randomUUID } from "node:crypto";

import { jsonError, jsonSuccess } from "@/server/api/envelope";
import type { QuestionService } from "@/server/questions/questionService";
import type { QuestionDto, TrainingDayNumber } from "@/server/questions/types";

export type QuestionAvailabilityStatus = "completed" | "available" | "locked";

export type QuestionWithStatus = QuestionDto & {
  status: QuestionAvailabilityStatus;
};

export type GetQuestionsUser = {
  id: string;
};

export type QuestionProgress = {
  currentDay: TrainingDayNumber;
  completedDays: TrainingDayNumber[];
};

export type GetQuestionsDependencies = {
  getUser: () => Promise<GetQuestionsUser | null>;
  questionService: Pick<QuestionService, "getQuestionByDay" | "listTrainingSequence">;
  resolveProgress?: (userId: string) => Promise<QuestionProgress>;
};

type QuestionsQuery =
  | {
      mode: "today";
    }
  | {
      mode: "all";
    }
  | {
      mode: "day";
      dayNumber: TrainingDayNumber;
    };

type ValidationResult =
  | {
      ok: true;
      query: QuestionsQuery;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export async function resolveMvpQuestionProgress(
  _userId: string
): Promise<QuestionProgress> {
  return {
    currentDay: 1,
    completedDays: []
  };
}

export async function handleGetQuestions(
  request: Request,
  dependencies: GetQuestionsDependencies
) {
  const requestId = randomUUID();
  let user: GetQuestionsUser | null;

  try {
    user = await dependencies.getUser();
  } catch {
    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    );
  }

  if (!user) {
    return jsonError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      requestId,
      401
    );
  }

  const validation = parseQuestionsQuery(new URL(request.url));

  if (!validation.ok) {
    return jsonError(
      validation.code,
      validation.message,
      requestId,
      400
    );
  }

  const resolveProgress =
    dependencies.resolveProgress ?? resolveMvpQuestionProgress;

  try {
    if (validation.query.mode === "day") {
      const question = await dependencies.questionService.getQuestionByDay(
        validation.query.dayNumber
      );

      return jsonSuccess({ question }, requestId);
    }

    const progress = await resolveProgress(user.id);

    if (validation.query.mode === "today") {
      const question = await dependencies.questionService.getQuestionByDay(
        progress.currentDay
      );

      return jsonSuccess({ question }, requestId);
    }

    const questions = await dependencies.questionService.listTrainingSequence();

    return jsonSuccess(
      {
        questions: questions.map((question) =>
          attachQuestionStatus(question, progress)
        )
      },
      requestId
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("was not found")) {
      return jsonError("QUESTION_NOT_FOUND", message, requestId, 404);
    }

    return jsonError(
      "QUESTIONS_REQUEST_FAILED",
      "Unable to load questions.",
      requestId,
      500
    );
  }
}

function parseQuestionsQuery(url: URL): ValidationResult {
  const day = url.searchParams.get("day");

  if (day !== null) {
    if (!/^[1-7]$/.test(day)) {
      return {
        ok: false,
        code: "INVALID_DAY",
        message: "day must be an integer between 1 and 7."
      };
    }

    return {
      ok: true,
      query: {
        mode: "day",
        dayNumber: Number(day) as TrainingDayNumber
      }
    };
  }

  const scope = url.searchParams.get("scope") ?? "today";

  if (scope !== "today" && scope !== "all") {
    return {
      ok: false,
      code: "INVALID_SCOPE",
      message: "scope must be either today or all."
    };
  }

  return {
    ok: true,
    query: {
      mode: scope
    }
  };
}

function attachQuestionStatus(
  question: QuestionDto,
  progress: QuestionProgress
): QuestionWithStatus {
  const completedDays = new Set(progress.completedDays);
  let status: QuestionAvailabilityStatus = "locked";

  if (completedDays.has(question.dayNumber)) {
    status = "completed";
  } else if (question.dayNumber === progress.currentDay) {
    status = "available";
  }

  return {
    ...question,
    status
  };
}
