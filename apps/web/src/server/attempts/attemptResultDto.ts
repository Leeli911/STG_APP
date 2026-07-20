import type {
  AiFeedbackRow,
  AttemptResultDto,
  AttemptRow,
  ScoreRow
} from "@/server/attempts/types";

export function toAttemptResultDto({
  attempt,
  score,
  feedback,
  sessionId
}: {
  attempt: AttemptRow;
  score: ScoreRow;
  feedback: AiFeedbackRow;
  sessionId?: string | null;
}): AttemptResultDto {
  if (attempt.status !== "completed") {
    throw new Error("Attempt result is only available for completed attempts.");
  }

  return {
    ...(sessionId ? { sessionId } : {}),
    attempt: {
      status: "completed",
      originalAnswer: attempt.original_answer,
      submittedAt: attempt.created_at,
      feedbackMode: attempt.ai_model === "mock" ? "mock" : "live"
    },
    score: {
      total: score.total_score,
      answer_relevance: score.answer_relevance,
      core_message: score.core_message,
      structure: score.structure,
      evidence: score.evidence,
      interview_impact: score.interview_impact
    },
    diagnosis: feedback.diagnosis,
    rewrite: feedback.rewrite,
    whyBetter: feedback.why_better,
    growthSuggestion: feedback.growth_suggestion
  };
}

export function toFailedAttemptResultDto({
  attempt
}: {
  attempt: AttemptRow;
}): AttemptResultDto {
  if (attempt.status !== "failed") {
    throw new Error("Failed attempt result is only available for failed attempts.");
  }

  return {
    attempt: {
      status: "failed",
      originalAnswer: attempt.original_answer,
      submittedAt: attempt.created_at,
      retryAvailable: true
    }
  };
}

export function toProcessingAttemptResultDto({
  attempt,
  retryAfterMs = 1_500
}: {
  attempt: AttemptRow;
  retryAfterMs?: number;
}): AttemptResultDto {
  if (attempt.status === "completed" || attempt.status === "failed") {
    throw new Error("Processing result requires a non-terminal attempt.");
  }

  return {
    attempt: {
      status: attempt.status,
      originalAnswer: attempt.original_answer,
      submittedAt: attempt.created_at,
      retryAfterMs
    }
  };
}
