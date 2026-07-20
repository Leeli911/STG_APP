import type { AttemptState, AiJobStatus } from "@/server/ai/jobs/types";

export type AttemptStateEvent =
  | "start_analysis"
  | "finish_analysis"
  | "finish_coaching"
  | "start_rescore"
  | "finish_rescore"
  | "reject_revision"
  | "fail"
  | "retry";

export type AiJobStateEvent =
  | "submit"
  | "provider_progress"
  | "provider_complete"
  | "provider_fail"
  | "provider_cancel"
  | "retry";

const attemptTransitions: Record<
  AttemptState,
  Partial<Record<AttemptStateEvent, AttemptState>>
> = {
  queued: { start_analysis: "analyzing", fail: "failed" },
  analyzing: { finish_analysis: "coaching", fail: "failed" },
  coaching: { finish_coaching: "feedback_ready", fail: "failed" },
  feedback_ready: {
    start_rescore: "rescoring",
    reject_revision: "completed",
    fail: "failed"
  },
  rescoring: { finish_rescore: "completed", fail: "failed" },
  completed: {},
  failed: { retry: "queued" }
};

const jobTransitions: Record<
  AiJobStatus,
  Partial<Record<AiJobStateEvent, AiJobStatus>>
> = {
  queued: { submit: "submitted", provider_fail: "failed" },
  submitted: {
    provider_progress: "in_progress",
    provider_complete: "completed",
    provider_fail: "failed",
    provider_cancel: "cancelled"
  },
  in_progress: {
    provider_progress: "in_progress",
    provider_complete: "completed",
    provider_fail: "failed",
    provider_cancel: "cancelled"
  },
  completed: {},
  failed: { retry: "queued" },
  cancelled: { retry: "queued" }
};

export function transitionAttemptState(
  current: AttemptState,
  event: AttemptStateEvent
): AttemptState {
  return transition("attempt", current, event, attemptTransitions[current]);
}
export function transitionAiJobStatus(
  current: AiJobStatus,
  event: AiJobStateEvent
): AiJobStatus {
  return transition("AI job", current, event, jobTransitions[current]);
}

export function toAttemptState(status: string): AttemptState {
  switch (status) {
    case "submitted":
    case "mock_result_generating":
    case "queued":
      return "queued";
    case "analysis_running":
    case "analyzing":
      return "analyzing";
    case "coaching_running":
    case "coaching":
      return "coaching";
    case "feedback_ready":
      return "feedback_ready";
    case "rescoring":
      return "rescoring";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      throw new Error(`Unknown attempt status: ${status}`);
  }
}

function transition<TState extends string, TEvent extends string>(
  label: string,
  current: TState,
  event: TEvent,
  available: Partial<Record<TEvent, TState>>
) {
  const next = available[event];
  if (!next) {
    throw new Error(`Invalid ${label} transition: ${current} -> ${event}`);
  }
  return next;
}
