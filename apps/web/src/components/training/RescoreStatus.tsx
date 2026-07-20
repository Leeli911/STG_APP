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
        <p className="text-sm font-medium">正在重新评分最终稿…</p>
        <p className="mt-1 text-sm">
          系统正在用同一套评分标准检查最终版本。
        </p>
      </section>
    );
  }

  if (session.status === "rescore_failed") {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <p className="text-sm font-semibold">重新评分暂未完成</p>
        <p className="mt-1 text-sm">
          最终稿已经保存。你可以使用同一修订决策重新评分。
        </p>
        <button
          className="mt-4 rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={disabled || !canRetry}
          onClick={onRetry}
          type="button"
        >
          重新评分
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
      <p className="text-sm font-semibold text-emerald-800">重新评分已完成</p>
      <ScoreComparison session={session} />
      <div className="mt-4 rounded-md bg-white p-4">
        <p className="text-sm font-medium text-slate-500">最终稿</p>
        <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-900">
          {session.final.text}
        </p>
      </div>
    </section>
  );
}

function ScoreComparison({
  session
}: {
  session: Extract<TrainingSessionDto, { status: "completed" }>;
}) {
  const totalDelta =
    session.delta?.total ?? session.scoreAfter.total - session.scoreBefore.total;
  const beforeByDimension = new Map(
    session.scoreBefore.dimensions.map((item) => [item.dimension, item])
  );

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-emerald-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ScoreMetric
          label={session.sourceMode === "demo" ? "初始规则得分" : "初始总分"}
          value={session.scoreBefore.total}
        />
        <ScoreMetric
          label={session.sourceMode === "demo" ? "最终规则得分" : "最终总分"}
          value={session.scoreAfter.total}
        />
        <ScoreMetric label="分数变化" value={formatSigned(totalDelta)} emphasized />
      </div>

      {session.scoreAfter.dimensions.length > 0 ? (
        <div>
          <p className="text-sm font-semibold text-slate-800">维度变化</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {session.scoreAfter.dimensions.map((after) => {
              const before = beforeByDimension.get(after.dimension);
              const delta = before ? after.score - before.score : null;
              return (
                <li
                  className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
                  key={after.dimension}
                >
                  <span className="text-slate-700">
                    {dimensionLabel(after.dimension, after.displayName)}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {before?.score ?? "—"} → {after.score}
                    {delta === null ? "" : `（${formatSigned(delta)}）`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className="text-xs leading-5 text-slate-500">
        {session.sourceMode === "demo"
          ? "规则得分只反映本次表达是否结论先行，不代表完整面试能力或经验证的能力提升。"
          : "分数变化来自同一训练记录的系统评估，用于帮助你比较表达版本，不代表经验证的能力提升。"}
      </p>
    </div>
  );
}

function ScoreMetric({
  label,
  value,
  emphasized = false
}: {
  label: string;
  value: number | string;
  emphasized?: boolean;
}) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={
          emphasized
            ? "mt-1 text-2xl font-semibold text-emerald-700"
            : "mt-1 text-2xl font-semibold text-slate-900"
        }
      >
        {value}
      </p>
    </div>
  );
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function dimensionLabel(dimension: string, fallback: string) {
  const labels: Record<string, string> = {
    relevance: "回答相关性",
    core_message: "核心信息",
    structure: "表达结构",
    evidence: "事实证据",
    interview_impact: "面试影响力"
  };
  return labels[dimension] ?? fallback;
}
