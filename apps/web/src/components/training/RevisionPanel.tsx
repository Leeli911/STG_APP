"use client";

import type { RevisionAction } from "@/server/training-sessions/types";

type RevisionPanelProps = {
  selectedAction: RevisionAction | null;
  editText: string;
  validationError: string | null;
  disabled: boolean;
  onSelectAction(action: RevisionAction): void;
  onEditTextChange(value: string): void;
  onSubmit(): void;
};

const EDIT_TEXT_MAX_LENGTH = 6000;

export function RevisionPanel({
  selectedAction,
  editText,
  validationError,
  disabled,
  onSelectAction,
  onEditTextChange,
  onSubmit
}: RevisionPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-500">修订决策</p>
        <h2 className="text-xl font-semibold text-slate-900">
          选择你的最终回答
        </h2>
        <p className="text-sm text-slate-600">
          你可以采用修改建议、保留原稿，或在参考建议后自己完成最终版本。
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <DecisionButton
          action="accepted"
          disabled={disabled}
          isSelected={selectedAction === "accepted"}
          label="采用修改建议"
          onSelect={onSelectAction}
        />
        <DecisionButton
          action="rejected"
          disabled={disabled}
          isSelected={selectedAction === "rejected"}
          label="保留原稿"
          onSelect={onSelectAction}
        />
        <DecisionButton
          action="edited"
          disabled={disabled}
          isSelected={selectedAction === "edited"}
          label="自主编辑"
          onSelect={onSelectAction}
        />
      </div>

      {selectedAction === "edited" ? (
        <div className="mt-5 space-y-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="training-session-edited-answer"
          >
            编辑最终稿
          </label>
          <textarea
            className="min-h-36 w-full rounded-md border border-slate-300 p-3 text-sm leading-6 text-slate-900 shadow-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:bg-slate-100 disabled:text-slate-500"
            disabled={disabled}
            id="training-session-edited-answer"
            maxLength={EDIT_TEXT_MAX_LENGTH}
            onChange={(event) => onEditTextChange(event.target.value)}
            value={editText}
          />
          <p className="text-right text-xs text-slate-500">
            {editText.length} / {EDIT_TEXT_MAX_LENGTH}
          </p>
        </div>
      ) : null}

      {validationError ? (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          {validationError}
        </p>
      ) : null}

      <button
        className="mt-5 rounded-md bg-focus px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={disabled}
        onClick={onSubmit}
        type="button"
      >
        提交修订
      </button>
    </section>
  );
}

function DecisionButton({
  action,
  disabled,
  isSelected,
  label,
  onSelect
}: {
  action: RevisionAction;
  disabled: boolean;
  isSelected: boolean;
  label: string;
  onSelect(action: RevisionAction): void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={
        isSelected
          ? "rounded-md border border-focus bg-focus/10 px-4 py-2 text-sm font-semibold text-focus disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
          : "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      }
      disabled={disabled}
      onClick={() => onSelect(action)}
      type="button"
    >
      {label}
    </button>
  );
}
