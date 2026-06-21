"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  AttemptResultDto,
  CompletedAttemptResultDto
} from "@/server/attempts";

type ResultEnvelope = {
  ok: true;
  data: {
    result: AttemptResultDto;
  };
};

type ErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export function ResultClient({
  attemptId,
  isDevelopment
}: {
  attemptId: string;
  isDevelopment: boolean;
}) {
  const [result, setResult] = useState<AttemptResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadResult() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/attempts/${attemptId}/result`);
        const body = (await response.json()) as ResultEnvelope | ErrorEnvelope;

        if (!response.ok || !body.ok) {
          throw new Error(body.ok ? "Unable to load result." : body.error.message);
        }

        if (isMounted) {
          setResult(body.data.result);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load result."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadResult();

    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  const isMockFeedback =
    result?.attempt.status === "completed" &&
    result.attempt.feedbackMode === "mock";
  const completedResult = isCompletedResult(result) ? result : null;
  const failedResult = result?.attempt.status === "failed" ? result : null;

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">Result</h1>
          {isDevelopment && isMockFeedback ? (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              Development Mock Feedback
            </span>
          ) : null}
        </div>
        <p className="max-w-2xl text-slate-600">
          Your answer has been saved and evaluated.
        </p>
      </section>

      {isLoading ? <p className="text-slate-600">Loading result...</p> : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {failedResult ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Feedback generation failed</h2>
            <p className="text-slate-700">
              We could not generate safe, valid feedback for this submission.
            </p>
          </div>
          <Link
            href="/workspace"
            className="inline-flex rounded-md bg-focus px-4 py-2 text-sm font-medium text-white"
          >
            Retry practice
          </Link>
        </section>
      ) : null}

      {completedResult ? (
        <>
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500">Total Score</p>
              <p className="text-4xl font-semibold">{completedResult.score.total}</p>
            </div>
            <dl className="grid gap-3 md:grid-cols-5">
              {scoreItems(completedResult).map((item) => (
                <div key={item.label} className="space-y-1">
                  <dt className="text-sm text-slate-500">{item.label}</dt>
                  <dd className="text-xl font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">主要诊断</h2>
            {completedResult.diagnosis.map((item) => (
              <div key={item.issue_type} className="space-y-2">
                <p className="text-slate-700">{item.evidence}</p>
                <p className="text-slate-700">{item.why_it_matters}</p>
                <p className="text-slate-700">{item.fix_direction}</p>
              </div>
            ))}
          </section>

          <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Original Answer</h2>
            <p className="whitespace-pre-wrap text-slate-700">
              {completedResult.attempt.originalAnswer}
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">AI Rewrite</h2>
            <p className="text-sm font-medium text-slate-500">
              {completedResult.rewrite.structure_used}
            </p>
            <p className="whitespace-pre-wrap text-slate-700">
              {completedResult.rewrite.text}
            </p>
            <p className="text-sm text-slate-500">
              {completedResult.rewrite.fact_preservation_note}
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Why Better</h2>
            {completedResult.whyBetter.map((item) => (
              <div key={item.changed_what} className="space-y-1">
                <h3 className="font-semibold">{item.changed_what}</h3>
                <p className="text-slate-700">{item.why_changed}</p>
                <p className="text-slate-700">{item.impact}</p>
              </div>
            ))}
          </section>

          <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Growth Suggestion</h2>
            <p className="text-slate-700">
              {completedResult.growthSuggestion.focus_for_next_practice}
            </p>
            <p className="text-slate-700">
              {completedResult.growthSuggestion.micro_drill}
            </p>
            <p className="text-slate-700">
              {completedResult.growthSuggestion.example_sentence_frame}
            </p>
            <p className="text-sm font-medium text-slate-500">
              {completedResult.growthSuggestion.estimated_next_level}
            </p>
          </section>

          <Link
            href="/dashboard"
            className="inline-flex rounded-md bg-focus px-4 py-2 text-sm font-medium text-white"
          >
            返回 Dashboard
          </Link>
        </>
      ) : null}
    </main>
  );
}

function isCompletedResult(
  result: AttemptResultDto | null
): result is CompletedAttemptResultDto {
  return result?.attempt.status === "completed";
}

function scoreItems(result: CompletedAttemptResultDto) {
  return [
    {
      label: "Answer Relevance",
      value: result.score.answer_relevance
    },
    {
      label: "Core Message",
      value: result.score.core_message
    },
    {
      label: "Structure",
      value: result.score.structure
    },
    {
      label: "Evidence",
      value: result.score.evidence
    },
    {
      label: "Interview Impact",
      value: result.score.interview_impact
    }
  ];
}
