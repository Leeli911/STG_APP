"use client";

import { useMemo, useState, type FormEvent } from "react";

import { createDemoTrainingSessionGateway } from "@/features/training-session/DemoAdapter";
import { TrainingSessionController } from "@/features/training-session/TrainingSessionController";
import { TrainingSessionScreen } from "@/features/training-session/TrainingSessionScreen";

const demoInitialAttemptId = "00000000-0000-4000-8000-000000000101";
const demoCreateSessionKey = "training-demo:create-session";
const demoRevisionKey = "training-demo:revision";
const demoDecisionTime = "2026-06-25T00:03:00.000Z";
const demoDraftText =
  "团队做决策时，经常会遇到信息分散、问题难以判断的情况。我希望通过数据分析帮助团队更清楚地理解业务问题。";

export default function TrainingDemoPage() {
  const [answer, setAnswer] = useState(demoDraftText);
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const gateway = useMemo(
    () =>
      createDemoTrainingSessionGateway({
        draftText: submittedAnswer ?? demoDraftText
      }),
    [submittedAnswer]
  );

  if (!submittedAnswer) {
    return (
      <main className="mx-auto max-w-3xl space-y-6">
        <section className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-focus">
            公开确定性演示
          </p>
          <h1 className="text-3xl font-semibold">训练体验题</h1>
          <p className="text-slate-600">
            体验完整的提交、反馈、修订和分数对比流程。此演示不需要登录，
            也不会调用外部数据库或模型服务。你输入的内容只在当前浏览器中按“结论先行”规则分析。
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm font-medium text-slate-500">第 1 天 · 核心信息</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            请用一段话说明：你希望通过数据分析为团队带来什么价值？
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            建议先说结论，再补充你关注的业务问题与期望影响。
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-800" htmlFor="demo-answer">
              你的回答
            </label>
            <textarea
              className="min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-base leading-7 shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              id="demo-answer"
              onChange={(event) => {
                setAnswer(event.target.value);
                setValidationError(null);
              }}
              value={answer}
            />
            {validationError ? (
              <p className="text-sm text-red-700" role="alert">
                {validationError}
              </p>
            ) : null}
            <button
              className="rounded-md bg-focus px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
              type="submit"
            >
              提交回答
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <TrainingSessionController
      currentTime={readDemoDecisionTime}
      gateway={gateway}
      initialAttemptId={demoInitialAttemptId}
      makeCreateSessionIdempotencyKey={makeDemoCreateSessionKey}
      makeRevisionIdempotencyKey={makeDemoRevisionKey}
    >
      {(viewModel) => (
        <div className="space-y-6">
          <TrainingSessionScreen viewModel={viewModel} />
          {viewModel.session?.status === "completed" ? (
            <section className="rounded-lg border border-blue-200 bg-blue-50 p-6">
              <h2 className="text-lg font-semibold text-blue-950">把规则再用一次</h2>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                换一个真实回答重新练习：先用第一句话直接回答问题，再用后续内容支撑它。
              </p>
              <button
                className="mt-4 rounded-md bg-focus px-4 py-2 text-sm font-semibold text-white"
                onClick={restartDemo}
                type="button"
              >
                用新回答再练一次
              </button>
            </section>
          ) : null}
        </div>
      )}
    </TrainingSessionController>
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = answer.trim();
    if (normalized.length < 10) {
      setValidationError("请至少输入 10 个字符后再提交。");
      return;
    }

    setSubmittedAnswer(normalized);
  }

  function restartDemo() {
    setAnswer("");
    setSubmittedAnswer(null);
    setValidationError(null);
  }
}

function makeDemoCreateSessionKey() {
  return demoCreateSessionKey;
}

function makeDemoRevisionKey() {
  return demoRevisionKey;
}

function readDemoDecisionTime() {
  return demoDecisionTime;
}
