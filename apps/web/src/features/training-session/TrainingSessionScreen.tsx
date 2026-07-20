"use client";

import { ExplainableRubric } from "@/components/training/ExplainableRubric";
import { RescoreStatus } from "@/components/training/RescoreStatus";
import { RevisionPanel } from "@/components/training/RevisionPanel";
import { SuggestionPanel } from "@/components/training/SuggestionPanel";
import type { TrainingSessionControllerViewModel } from "@/features/training-session/TrainingSessionController";
import type { TrainingSessionDto } from "@/server/training-sessions";

type TrainingSessionScreenProps =
  | {
      viewModel: TrainingSessionControllerViewModel;
      session?: never;
    }
  | {
      session: TrainingSessionDto;
      viewModel?: never;
    };

export function TrainingSessionScreen(props: TrainingSessionScreenProps) {
  const viewModel = "viewModel" in props ? props.viewModel : null;
  const session = viewModel?.session ?? props.session;

  if (!session) {
    return (
      <main className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">正在读取训练反馈…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-focus">
          第 {session.practiceDay} 天
        </p>
        <h1 className="text-3xl font-semibold">训练反馈</h1>
        <p className="max-w-2xl text-slate-600">
          先看懂评分依据，再决定采用建议、保留原稿或自主编辑。
        </p>
        {session.sourceMode === "demo" ? (
          <p className="max-w-2xl rounded-md bg-blue-50 p-3 text-sm text-blue-800">
            公开演示只检查“结论是否先出现”这一项规则；规则得分用于比较表达顺序，不代表完整面试能力。
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-500">原始回答</p>
        <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-900">
          {session.draft.text}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium text-slate-500">
          {session.sourceMode === "demo" ? "初始规则得分" : "初始总分"}
        </p>
        <p className="mt-1 text-4xl font-semibold text-slate-900">
          {session.scoreBefore.total}
        </p>
      </section>

      <ExplainableRubric dimensions={session.scoreBefore.dimensions} />

      <SuggestionPanel suggestion={session.suggestion} />

      {viewModel?.networkError ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {viewModel.networkError}
        </p>
      ) : null}

      {viewModel && session.status === "feedback_ready" ? (
        <RevisionPanel
          disabled={viewModel.controlsDisabled}
          editText={viewModel.editText}
          onEditTextChange={viewModel.setEditText}
          onSelectAction={viewModel.selectAction}
          onSubmit={viewModel.submitRevision}
          selectedAction={viewModel.selectedAction}
          validationError={viewModel.validationError}
        />
      ) : null}

      <RescoreStatus
        canRetry={viewModel?.canRetry ?? false}
        disabled={viewModel?.controlsDisabled ?? false}
        onRetry={viewModel?.retryRevision}
        session={session}
      />
    </main>
  );
}
