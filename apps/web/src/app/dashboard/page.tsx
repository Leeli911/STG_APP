"use client";

import Link from "next/link";

import { useTrainingOverview } from "@/features/training-overview/useTrainingOverview";
import type {
  TrainingHistoryItem,
  TrainingOverview
} from "@/server/training-overview";

export default function DashboardPage() {
  const { overview, isLoading, error, retry } = useTrainingOverview();

  return (
    <DashboardContent
      error={error}
      isLoading={isLoading}
      onRetry={() => void retry()}
      overview={overview}
    />
  );
}

function DashboardContent({
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
  return (
    <main className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-focus">
          结构化表达训练场
        </p>
        <h1 className="text-3xl font-semibold">训练概览</h1>
        <p className="max-w-2xl text-slate-600">
          用七天完成一次从原始回答、智能反馈到自主修订的结构化表达训练。
        </p>
      </section>

      {isLoading ? <OverviewLoading /> : null}

      {error ? (
        <section
          className="rounded-lg border border-amber-200 bg-amber-50 p-6"
          role="alert"
        >
          <h2 className="font-semibold text-amber-900">训练数据暂时无法读取</h2>
          <p className="mt-1 text-sm text-amber-800">{error}</p>
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

      {overview ? <LoadedDashboard overview={overview} /> : null}
    </main>
  );
}

function LoadedDashboard({ overview }: { overview: TrainingOverview }) {
  const { progress } = overview;
  const recentHistory = overview.history.slice(0, 3);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="课程进度"
          value={`${progress.completedDays.length} / ${progress.totalDays}`}
          detail={progress.isComplete ? "七天训练已完成" : `当前第 ${progress.currentDay} 天`}
        />
        <MetricCard
          label="最近分数变化"
          value={formatDelta(overview.latestCompleted?.delta ?? null)}
          detail={`已记录 ${overview.history.length} 次训练`}
        />
        <MetricCard
          label="当前训练重点"
          value={overview.weakestDimension?.label ?? "等待首份评分"}
          detail={
            overview.weakestDimension
              ? `平均 ${overview.weakestDimension.average.toFixed(1)} / 20`
              : "完成训练后自动生成"
          }
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">七天进度</h2>
            <p className="mt-1 text-sm text-slate-600">
              完成一次明确的修订决策后，下一天才会解锁。
            </p>
          </div>
          {progress.isComplete ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
              已完成
            </span>
          ) : null}
        </div>
        <ol className="mt-6 grid grid-cols-7 gap-2" aria-label="七天训练进度">
          {Array.from({ length: progress.totalDays }, (_, index) => index + 1).map(
            (day) => {
              const completed = progress.completedDays.includes(
                day as (typeof progress.completedDays)[number]
              );
              const current = !progress.isComplete && day === progress.currentDay;
              return (
                <li
                  aria-current={current ? "step" : undefined}
                  className={
                    completed
                      ? "rounded-lg bg-emerald-100 px-2 py-3 text-center text-sm font-semibold text-emerald-800"
                      : current
                        ? "rounded-lg bg-focus px-2 py-3 text-center text-sm font-semibold text-white"
                        : "rounded-lg bg-slate-100 px-2 py-3 text-center text-sm font-medium text-slate-500"
                  }
                  key={day}
                >
                  <span className="block text-xs">第</span>
                  {day}
                  <span className="block text-xs">天</span>
                </li>
              );
            }
          )}
        </ol>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {progress.isComplete ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-emerald-700">七天训练已完成</p>
            <h2 className="text-2xl font-semibold">回看你的修订轨迹</h2>
            <p className="max-w-2xl text-slate-600">
              你已完成当前课程。历史页会保留每次原稿、最终稿与分数变化，不会重新回到第一天。
            </p>
            <CompletionObservation overview={overview} />
            <Link
              className="inline-flex rounded-md bg-focus px-4 py-2 text-sm font-semibold text-white"
              href="/history"
            >
              查看训练记录
            </Link>
          </div>
        ) : overview.todayQuestion ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-focus">
                今日训练 · 第 {overview.todayQuestion.dayNumber} 天
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                {overview.todayQuestion.title}
              </h2>
            </div>
            <p className="text-lg text-slate-800">{overview.todayQuestion.prompt}</p>
            <p className="text-sm text-slate-600">
              训练目标：{overview.todayQuestion.learningGoal}
            </p>
            <Link
              className="inline-flex rounded-md bg-focus px-4 py-2 text-sm font-semibold text-white"
              href="/workspace"
            >
              开始今日训练
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold">今日题目尚未就绪</h2>
            <p className="mt-2 text-slate-600">请稍后刷新，或先体验公开演示。</p>
            <Link className="mt-4 inline-flex text-sm font-semibold text-focus" href="/training-demo">
              体验训练演示 →
            </Link>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">最近训练</h2>
            <p className="mt-1 text-sm text-slate-600">继续未完成修订，或回看已经完成的回答。</p>
          </div>
          <Link className="text-sm font-semibold text-focus" href="/history">
            查看全部
          </Link>
        </div>

        {recentHistory.length > 0 ? (
          <div className="grid gap-3">
            {recentHistory.map((item) => (
              <RecentTraining key={`${item.source}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600">
            完成第一份回答后，这里会显示你的训练轨迹。
          </div>
        )}
      </section>
    </>
  );
}

function CompletionObservation({ overview }: { overview: TrainingOverview }) {
  const completed = overview.history.filter(
    (item) => item.source === "practice_session" && item.status === "completed"
  );
  const decisions = completed.reduce(
    (counts, item) => {
      if (item.decision) counts[item.decision] += 1;
      return counts;
    },
    { accepted: 0, rejected: 0, edited: 0 }
  );
  const deltas = completed.flatMap((item) =>
    item.delta === null ? [] : [item.delta]
  );
  const averageDelta =
    deltas.length > 0
      ? deltas.reduce((total, delta) => total + delta, 0) / deltas.length
      : null;

  return (
    <section className="my-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold text-slate-900">七天观察摘要</h3>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">完成训练</dt>
          <dd className="mt-1 font-semibold text-slate-900">{completed.length}</dd>
        </div>
        <div>
          <dt className="text-slate-500">修订行为</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            采用 {decisions.accepted} · 保留 {decisions.rejected} · 编辑 {decisions.edited}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">平均系统分变化</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {averageDelta === null ? "—" : formatDelta(Number(averageDelta.toFixed(1)))}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        当前待加强维度：{overview.weakestDimension?.label ?? "样本不足"}。以上仅描述系统记录的训练与评分变化，不代表已证明的能力提升。
      </p>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function RecentTraining({ item }: { item: TrainingHistoryItem }) {
  return (
    <Link
      className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-focus"
      href={item.href}
    >
      <div>
        <p className="text-sm font-medium text-focus">第 {item.practiceDay} 天</p>
        <p className="font-semibold text-slate-900">{item.title}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-slate-800">
          {item.scoreBefore ?? "—"}
          {item.scoreAfter !== null ? ` → ${item.scoreAfter}` : ""}
        </p>
        <p className="text-xs text-slate-500">{statusLabel(item.status)}</p>
      </div>
    </Link>
  );
}

function OverviewLoading() {
  return (
    <section aria-live="polite" className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
      正在读取训练进度…
    </section>
  );
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

function formatDelta(delta: number | null) {
  if (delta === null) return "等待完成修订";
  return delta > 0 ? `+${delta}` : String(delta);
}
