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
    question: QuestionDto | null;
    courseCompleted?: boolean;
    liveTrainingV2Enabled?: boolean;
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
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [liveTrainingV2Enabled, setLiveTrainingV2Enabled] = useState(true);
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
          throw new Error(body.ok ? "无法加载今日题目。" : body.error.message);
        }

        if (isMounted) {
          setQuestion(body.data.question);
          setCourseCompleted(
            body.data.courseCompleted === true || body.data.question === null
          );
          setLiveTrainingV2Enabled(
            body.data.liveTrainingV2Enabled !== false
          );
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "无法加载今日题目。"
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
      setError("题目尚未加载完成，暂时不能提交。 ");
      return;
    }

    const validation = validateMinimumAnswer(answer);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    if (answer.trim().length > MAX_ANSWER_LENGTH) {
      setError("回答不能超过 6000 个字符。 ");
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
        throw new Error(body.ok ? "无法提交回答。" : body.error.message);
      }

      router.push(
        liveTrainingV2Enabled
          ? `/training/${body.data.attempt.id}`
          : `/result/${body.data.attempt.id}`
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "无法提交回答。"
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">今日训练</h1>
        <p className="max-w-2xl text-slate-600">
          专注完成今天的一项结构化面试表达练习。
        </p>
      </section>

      {isLoadingQuestion ? (
        <p className="text-slate-600">正在加载题目…</p>
      ) : null}

      {!isLoadingQuestion && courseCompleted ? (
        <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-2xl font-semibold text-emerald-950">
            七天训练已完成
          </h2>
          <p className="max-w-2xl leading-7 text-emerald-900">
            你已经完成当前课程。可以前往 Dashboard 查看七天进度与真实训练记录。
          </p>
          <button
            type="button"
            className="rounded-md bg-focus px-4 py-2 text-sm font-medium text-white"
            onClick={() => router.push("/dashboard")}
          >
            查看训练总结
          </button>
        </section>
      ) : null}

      {question ? (
        <form onSubmit={submitAnswer} className="space-y-6">
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-500">
                第 {question.dayNumber} 天
              </p>
              <h2 className="text-2xl font-semibold">{question.title}</h2>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">情境</h3>
              <p className="text-slate-700">{question.scenario}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">问题</h3>
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
                你的回答
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
              placeholder="先直接回答问题，再补充理由或证据…"
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
            {isSubmitting ? "提交中…" : "提交回答"}
          </button>
        </form>
      ) : null}
    </main>
  );
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
