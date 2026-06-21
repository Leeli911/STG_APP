import type {
  AiFeedbackRow,
  AttemptResultDto,
  AttemptRow,
  ScoreRow
} from "@/server/attempts/types";

export function toAttemptResultDto({
  attempt,
  score,
  feedback
}: {
  attempt: AttemptRow;
  score: ScoreRow;
  feedback: AiFeedbackRow;
}): AttemptResultDto {
  if (attempt.status !== "completed") {
    throw new Error("Attempt result is only available for completed attempts.");
  }

  return {
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
