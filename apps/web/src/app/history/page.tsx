"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useTrainingOverview } from "@/features/training-overview/useTrainingOverview";
import type {
  TrainingHistoryItem,
  TrainingOverview
} from "@/server/training-overview";

type HistoryFilter = "all" | "completed" | "in_progress" | "failed";

export default function HistoryPage() {
  const { overview, isLoading, error, retry } = useTrainingOverview();

  return (
    <HistoryContent
      error={error}
      isLoading={isLoading}
      onRetry={() => void retry()}
      overview={overview}
    />
  );
}

function HistoryContent({
  overview,
  isLoading = false,
  error = null,
  onRetry
}: {
  overview: TrainingOverview | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [day, setDay] = useState("all");
  const filtered = useMemo(
    () =>
      (overview?.history ?? []).filter(
        (item) => matchesStatus(item, filter) && matchesDay(item, day)
      ),
    [day, filter, overview]
  );

  return (
    <main className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">训练记录</h1>
        <p className="max-w-2xl text-slate-600">
          回看每次原稿、修订决策、最终稿与分数变化。分数变化是系统评估结果，不代表经验证的学习效果。
        </p>
      </section>

      {isLoading ? (
        <p aria-live="polite" className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
          正在读取训练记录…
        </p>
      ) : null}

      {error ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6" role="alert">
          <p className="font-semibold text-amber-900">{error}</p>
          {onRetry ? (
            <button
              className="mt-4 rounded-md bg-amber-800 px-4 py-2 text-sm font-semibold text-white"
              onClick={onRetry}
              type="button"
            >
              重新加载
            </button>
          ) : null}
        </section>
      ) : null}

      {overview ? (
        <>
          <section className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="block">状态</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setFilter(event.target.value as HistoryFilter)}
                value={filter}
              >
                <option value="all">全部状态</option>
                <option value="completed">已完成</option>
                <option value="in_progress">进行中</option>
                <option value="failed">失败</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              <span className="block">课程日</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-3 py-2"
                onChange={(event) => setDay(event.target.value)}
                value={day}
              >
                <option value="all">全部课程日</option>
                {Array.from({ length: 7 }, (_, index) => index + 1).map(
                  (dayNumber) => (
                    <option key={dayNumber} value={String(dayNumber)}>
                      第 {dayNumber} 天
                    </option>
                  )
                )}
              </select>
            </label>
          </section>

          {filtered.length > 0 ? (
            <section aria-label="训练历史列表" className="space-y-4">
              {filtered.map((item) => (
                <HistoryCard item={item} key={`${item.source}-${item.id}`} />
              ))}
            </section>
          ) : (
            <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-lg font-semibold">暂无符合条件的训练记录</h2>
              <p className="mt-2 text-sm text-slate-600">
                开始一次训练后，原稿与后续修订会显示在这里。
              </p>
              <Link className="mt-4 inline-flex rounded-md bg-focus px-4 py-2 text-sm font-semibold text-white" href="/workspace">
                开始训练
              </Link>
            </section>
          )}
        </>
      ) : null}
    </main>
  );
}

function HistoryCard({ item }: { item: TrainingHistoryItem }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-focus">第 {item.practiceDay} 天</p>
          <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
          <p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {statusLabel(item.status)}
        </span>
      </header>

      <div className="mt-5 flex flex-wrap gap-6 border-y border-slate-100 py-4">
        <ScoreValue label="初始评分" value={item.scoreBefore} />
        <ScoreValue label="最终评分" value={item.scoreAfter} />
        <ScoreValue
          label="分数变化"
          value={item.delta}
          signed
        />
        <div>
          <p className="text-xs text-slate-500">修订决策</p>
          <p className="mt-1 font-semibold text-slate-900">
            {decisionLabel(item.decision)}
          </p>
        </div>
      </div>

      <details className="mt-4 rounded-lg bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          查看原稿与最终稿
        </summary>
        <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
          <div>
            <p className="font-semibold text-slate-900">原稿</p>
            <p className="mt-1 whitespace-pre-wrap">{item.originalAnswer}</p>
          </div>
          {item.finalAnswer ? (
            <div>
              <p className="font-semibold text-slate-900">最终稿</p>
              <p className="mt-1 whitespace-pre-wrap">{item.finalAnswer}</p>
            </div>
          ) : (
            <p className="text-slate-500">尚未提交最终稿。</p>
          )}
          <dl className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
            <VersionValue label="提示词版本" value={item.promptVersion} />
            <VersionValue label="评分标准版本" value={item.rubricVersion} />
            <VersionValue label="模型版本" value={item.modelVersion} />
          </dl>
        </div>
      </details>

      <Link className="mt-4 inline-flex text-sm font-semibold text-focus" href={item.href}>
        {item.status === "completed" ? "查看完整反馈" : "继续处理"} →
      </Link>
    </article>
  );
}

function VersionValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label} 版本</dt>
      <dd className="mt-1 break-all text-xs text-slate-700">{value ?? "未记录"}</dd>
    </div>
  );
}

function ScoreValue({
  label,
  value,
  signed = false
}: {
  label: string;
  value: number | null;
  signed?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">
        {value === null ? "—" : signed && value > 0 ? `+${value}` : value}
      </p>
    </div>
  );
}

function matchesStatus(item: TrainingHistoryItem, filter: HistoryFilter) {
  if (filter === "all") return true;
  if (filter === "completed") return item.status === "completed";
  if (filter === "failed") {
    return item.status === "failed" || item.status === "rescore_failed";
  }
  return !["completed", "failed", "rescore_failed"].includes(item.status);
}

function matchesDay(item: TrainingHistoryItem, day: string) {
  return day === "all" || item.practiceDay === Number(day);
}

function statusLabel(status: TrainingHistoryItem["status"]) {
  const labels: Record<TrainingHistoryItem["status"], string> = {
    submitted: "等待分析",
    queued: "已进入队列",
    analyzing: "正在分析",
    analysis_running: "正在分析",
    coaching: "正在生成反馈",
    coaching_running: "正在生成反馈",
    mock_result_generating: "正在生成反馈",
    failed: "处理失败",
    feedback_ready: "等待修订",
    rescoring: "正在重新评分",
    rescore_failed: "重新评分失败",
    completed: "已完成"
  };
  return labels[status];
}

function decisionLabel(decision: TrainingHistoryItem["decision"]) {
  if (decision === "accepted") return "采用修改建议";
  if (decision === "rejected") return "保留原稿";
  if (decision === "edited") return "自主编辑";
  return "尚未决定";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
