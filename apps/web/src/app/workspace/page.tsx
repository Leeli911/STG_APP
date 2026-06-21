"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MAX_ANSWER_LENGTH,
  validateMinimumAnswer
} from "@/lib/validation/answer";
import type { QuestionDto } from "@/server/questions";

type QuestionEnvelope = {
  ok: true;
  data: {
    question: QuestionDto;
  };
};

type AttemptEnvelope = {
  ok: true;
  data: {
    attempt: {
      id: string;
    };
  };
};

type ErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export default function WorkspacePage() {
  const router = useRouter();
  const idempotencyKey = useRef(createIdempotencyKey());
  const clientStartedAt = useRef(new Date().toISOString());
  const [question, setQuestion] = useState<QuestionDto | null>(null);
  const [answer, setAnswer] = useState("");
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadQuestion() {
      setIsLoadingQuestion(true);
      setError(null);

      try {
        const response = await fetch("/api/questions?scope=today");
        const body = (await response.json()) as QuestionEnvelope | ErrorEnvelope;

        if (!response.ok || !body.ok) {
          throw new Error(body.ok ? "Unable to load question." : body.error.message);
        }

        if (isMounted) {
          setQuestion(body.data.question);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load question."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingQuestion(false);
        }
      }
    }

    void loadQuestion();

    return () => {
      isMounted = false;
    };
  }, []);

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question) {
      setError("Unable to submit before the question has loaded.");
      return;
    }

    const validation = validateMinimumAnswer(answer);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    if (answer.trim().length > MAX_ANSWER_LENGTH) {
      setError("answer_text must be 6000 characters or fewer.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey.current
        },
        body: JSON.stringify({
          question_id: question.id,
          answer_text: answer,
          client_started_at: clientStartedAt.current
        })
      });
      const body = (await response.json()) as AttemptEnvelope | ErrorEnvelope;

      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Unable to submit answer." : body.error.message);
      }

      router.push(`/result/${body.data.attempt.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit answer."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">Workspace</h1>
        <p className="max-w-2xl text-slate-600">
          Complete today&apos;s structured interview communication training.
        </p>
      </section>

      {isLoadingQuestion ? (
        <p className="text-slate-600">Loading question...</p>
      ) : null}

      {question ? (
        <form onSubmit={submitAnswer} className="space-y-6">
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-500">
                Day {question.dayNumber}
              </p>
              <h2 className="text-2xl font-semibold">{question.title}</h2>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Scenario</h3>
              <p className="text-slate-700">{question.scenario}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">Question</h3>
              <p className="text-lg font-medium text-ink">{question.prompt}</p>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold">{question.knowledgeCard.title}</h3>
            <p className="text-slate-700">{question.knowledgeCard.content}</p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="answer" className="text-sm font-semibold">
                Your answer
              </label>
              <span className="text-sm text-slate-500">
                {answer.length} / {MAX_ANSWER_LENGTH}
              </span>
            </div>
            <p className="text-sm text-slate-500">建议 50-300 字</p>
            <textarea
              id="answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              maxLength={MAX_ANSWER_LENGTH}
              rows={10}
              className="w-full resize-y rounded-lg border border-slate-300 bg-white p-4 leading-7 outline-none focus:border-focus"
              placeholder="Write your answer here..."
            />
            {answer.length >= MAX_ANSWER_LENGTH ? (
              <p className="text-sm text-amber-700">已达到 6000 字符上限</p>
            ) : null}
          </section>

          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || answer.trim().length === 0}
            className="rounded-md bg-focus px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit answer"}
          </button>
        </form>
      ) : null}
    </main>
  );
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
