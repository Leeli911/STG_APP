"use client";

import type { TrainingSessionDto } from "@/server/training-sessions/types";

type RescoreStatusProps = {
  session: TrainingSessionDto;
  canRetry?: boolean;
  disabled?: boolean;
  onRetry?: () => void;
};

export function RescoreStatus({
  session,
  canRetry = false,
  disabled = false,
  onRetry
}: RescoreStatusProps) {
  if (session.status === "feedback_ready") {
    return null;
  }

  if (session.status === "rescoring") {
    return (
      <section className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-blue-900">
        <p className="text-sm font-medium">Re-scoring your final answer…</p>
        <p className="mt-1 text-sm">
          We are checking your final version with the same rubric.
        </p>
      </section>
    );
  }

  if (session.status === "rescore_failed") {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="text-sm font-semibold">Scoring could not finish.</p>
        <p className="mt-1 text-sm">
          Your final answer is saved. Retry scoring with the same decision.
        </p>
        <button
          className="mt-4 rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={disabled || !canRetry}
          onClick={onRetry}
          type="button"
        >
          Retry scoring
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
      <p className="text-sm font-semibold text-emerald-800">
        Re-score complete
      </p>
      <div className="mt-4 rounded-md bg-white p-4">
        <p className="text-sm font-medium text-slate-500">Final Answer</p>
        <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-900">
          {session.final.text}
        </p>
      </div>
    </section>
  );
}
