"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createLiveTrainingSessionGateway } from "@/features/training-session/LiveAdapter";
import { TrainingSessionController } from "@/features/training-session/TrainingSessionController";
import { TrainingSessionScreen } from "@/features/training-session/TrainingSessionScreen";

type AttemptStage =
  | "submitted"
  | "queued"
  | "analysis_running"
  | "analyzing"
  | "coaching_running"
  | "coaching"
  | "mock_result_generating"
  | "feedback_ready"
  | "completed"
  | "failed";

type AttemptResultEnvelope = {
  ok: true;
  data: {
    result: {
      sessionId?: string;
      attempt: {
        status: AttemptStage;
      };
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

const pollIntervalMs = 1_500;

export function TrainingAttemptClient({ attemptId }: { attemptId: string }) {
  const gateway = useMemo(() => createLiveTrainingSessionGateway(), []);
  const [stage, setStage] = useState<AttemptStage>("submitted");
  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      timer = setTimeout(() => void loadResult(), pollIntervalMs);
    };

    async function loadResult() {
      try {
        const response = await fetch(
          `/api/attempts/${encodeURIComponent(attemptId)}/result`,
          { cache: "no-store" }
        );
        const body = (await response.json()) as
          | AttemptResultEnvelope
          | ErrorEnvelope;

        if (!active) return;

        if (!response.ok || !body.ok) {
          const message = body.ok ? "训练结果暂时不可用。" : body.error.message;
          const isStillProcessing =
            response.status === 404 && /not ready|处理中|尚未完成/i.test(message);

          if (isStillProcessing) {
            setError(null);
            schedule();
            return;
          }

          throw new Error(message);
        }

        const nextStage = body.data.result.attempt.status;
        setStage(nextStage);
        setError(null);

        if (nextStage === "completed" || nextStage === "feedback_ready") {
          setSessionId(body.data.result.sessionId ?? null);
          setReady(true);
          return;
        }

        if (nextStage === "failed") {
          return;
        }

        schedule();
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "无法读取训练结果。"
        );
      }
    }

    void loadResult();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [attemptId]);

  if (error) {
    return (
      <main className="space-y-6">
        <StatusCard title="无法加载训练" description={error} />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-md bg-focus px-4 py-2 text-sm font-medium text-white"
            onClick={() => globalThis.location.reload()}
          >
            重试
          </button>
          <Link
            href="/workspace"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            返回训练区
          </Link>
        </div>
      </main>
    );
  }

  if (stage === "failed") {
    return (
      <main className="space-y-6">
        <StatusCard
          title="AI 反馈生成失败"
          description="本次回答已经保存，但系统未能生成安全且有效的反馈。你可以返回后重新练习。"
        />
        <Link
          href="/workspace"
          className="inline-flex rounded-md bg-focus px-4 py-2 text-sm font-medium text-white"
        >
          重新练习
        </Link>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="space-y-6" aria-live="polite">
        <StatusCard
          title="AI 正在分析你的回答"
          description={stageDescription(stage)}
        />
        <ol className="grid gap-3 text-sm sm:grid-cols-3">
          <ProgressStep active label="分析回答" />
          <ProgressStep
            active={stage === "coaching" || stage === "coaching_running"}
            label="生成教练反馈"
          />
          <ProgressStep active={false} label="进入修订训练" />
        </ol>
      </main>
    );
  }

  return (
    <TrainingSessionController
      gateway={gateway}
      initialAttemptId={attemptId}
      initialSessionId={sessionId}
    >
      {(viewModel) =>
        !viewModel.session && viewModel.networkError ? (
          <main className="space-y-6">
            <StatusCard
              title="训练 Session 创建失败"
              description={viewModel.networkError}
            />
            <button
              type="button"
              className="rounded-md bg-focus px-4 py-2 text-sm font-medium text-white"
              onClick={() => void viewModel.refreshSession()}
            >
              重试
            </button>
          </main>
        ) : (
          <TrainingSessionScreen viewModel={viewModel} />
        )
      }
    </TrainingSessionController>
  );
}

function StatusCard({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="max-w-2xl leading-7 text-slate-600">{description}</p>
    </section>
  );
}

function ProgressStep({ active, label }: { active: boolean; label: string }) {
  return (
    <li
      className={`rounded-lg border p-3 ${
        active
          ? "border-focus bg-blue-50 font-medium text-focus"
          : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      {label}
    </li>
  );
}

function stageDescription(stage: AttemptStage) {
  switch (stage) {
    case "coaching":
    case "coaching_running":
    case "mock_result_generating":
      return "评分已经完成，正在把诊断转化为可执行的修订建议。";
    case "analyzing":
    case "analysis_running":
      return "系统正在依据统一 Rubric 检查结构、证据和表达影响力。";
    default:
      return "回答已安全保存并进入处理队列，页面会自动更新。";
  }
}
