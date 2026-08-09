"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";

import {
  daySevenScenarios,
  evaluateDaySevenReport,
  evaluateDaySevenRevision,
  type DaySevenAssessment
} from "@/features/progressive-course/projectEvaluator";
import type {
  DaySevenSession,
  ProgressiveCourseSession
} from "@/features/progressive-course/progress";
import type { DaySevenOutcome } from "@/features/progressive-course/types";

export function DaySevenProject({
  outcome,
  scaffoldUseCount,
  session,
  stage,
  onCheckOriginal,
  onCheckRevision,
  onCheckTransfer,
  onComplete,
  onStart,
  onUpdate,
  onViewRevision,
  onViewTransfer
}: {
  outcome?: DaySevenOutcome;
  scaffoldUseCount: number;
  session: DaySevenSession;
  stage: ProgressiveCourseSession["stage"];
  onCheckOriginal(passed: boolean): void;
  onCheckRevision(): void;
  onCheckTransfer(passed: boolean): void;
  onComplete(transferFinalPassed: boolean): void;
  onStart(): void;
  onUpdate(update: Partial<DaySevenSession>): void;
  onViewRevision(): void;
  onViewTransfer(): void;
}) {
  const [error, setError] = useState<string | null>(null);
  const originalAssessment = useMemo(
    () => evaluateDaySevenReport(session.originalAnswer, "project"),
    [session.originalAnswer]
  );
  const revisionAssessment = useMemo(
    () => evaluateDaySevenReport(session.revisionAnswer, "project"),
    [session.revisionAnswer]
  );
  const revisionChange = useMemo(
    () =>
      evaluateDaySevenRevision({
        before: session.originalAnswer,
        after: session.revisionAnswer,
        beforeAssessment: originalAssessment,
        afterAssessment: revisionAssessment
      }),
    [
      originalAssessment,
      revisionAssessment,
      session.originalAnswer,
      session.revisionAnswer
    ]
  );
  const transferAssessment = useMemo(
    () => evaluateDaySevenReport(session.transferAnswer, "transfer"),
    [session.transferAnswer]
  );

  if (stage === "lesson") {
    return <ProjectIntro onStart={onStart} />;
  }
  if (stage === "project_draft") {
    return (
      <ProjectDraft
        assessment={session.originalChecked ? originalAssessment : null}
        error={error}
        onChange={(value) => {
          setError(null);
          onUpdate({ originalAnswer: value });
        }}
        onContinue={onViewRevision}
        onSubmit={(event) => {
          event.preventDefault();
          if (session.originalAnswer.trim().length < 20) {
            setError("请先完成一份可检查的首稿，至少输入 20 个字符。");
            return;
          }
          setError(null);
          onCheckOriginal(originalAssessment.passed);
        }}
        readOnly={session.originalChecked}
        value={session.originalAnswer}
      />
    );
  }
  if (stage === "project_revision") {
    return (
      <ProjectRevision
        assessment={session.revisionChecked ? revisionAssessment : null}
        change={session.revisionChecked ? revisionChange : null}
        error={error}
        onChange={(value) => {
          setError(null);
          onUpdate({
            revisionAnswer: value,
            revisionChecked: false
          });
        }}
        onContinue={onViewTransfer}
        onSubmit={(event) => {
          event.preventDefault();
          if (session.revisionAnswer.trim().length < 20) {
            setError("请在原稿上完成修改后再检查。");
            return;
          }
          setError(null);
          onCheckRevision();
        }}
        original={session.originalAnswer}
        value={session.revisionAnswer}
      />
    );
  }
  if (stage === "project_transfer") {
    return (
      <TransferPractice
        assessment={session.transferChecked ? transferAssessment : null}
        error={error}
        onChange={(value) => {
          setError(null);
          onUpdate({
            transferAnswer: value,
            transferChecked: false
          });
        }}
        onComplete={onComplete}
        onSubmit={(event) => {
          event.preventDefault();
          if (session.transferAnswer.trim().length < 20) {
            setError("请先完成一份可检查的迁移回答，至少输入 20 个字符。");
            return;
          }
          setError(null);
          onCheckTransfer(transferAssessment.passed);
        }}
        value={session.transferAnswer}
      />
    );
  }

  return (
    <CourseEvidenceSummary
      outcome={outcome}
      scaffoldUseCount={scaffoldUseCount}
    />
  );
}

function ProjectIntro({ onStart }: { onStart(): void }) {
  return (
    <section className="space-y-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-8">
      <div>
        <p className="text-sm font-medium text-focus">Day 7 · 预计约 10 分钟</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          毕业项目不是新知识，而是三份互不覆盖的证据
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          你会先独立完成一个全新情境，保留首稿并亲自修改，再回答第二个未见情境。没有答案模板，也不会调用 AI。
        </p>
      </div>
      <ol className="grid gap-3 text-sm leading-6 sm:grid-cols-3">
        <li className="rounded-xl bg-slate-50 p-4">
          <span className="font-semibold text-slate-950">1. 冻结首稿</span>
          <p className="mt-1 text-slate-600">首次提交后原稿不再覆盖，反馈只引用你的原文。</p>
        </li>
        <li className="rounded-xl bg-slate-50 p-4">
          <span className="font-semibold text-slate-950">2. 主动修改</span>
          <p className="mt-1 text-slate-600">修改框预填原稿；只改标点或少量词语不能进入迁移。</p>
        </li>
        <li className="rounded-xl bg-slate-50 p-4">
          <span className="font-semibold text-slate-950">3. 未见迁移</span>
          <p className="mt-1 text-slate-600">换一个不同业务情境，首次结果会单独保存，不用修改结果冒充首答。</p>
        </li>
      </ol>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        回答原文只保存在当前浏览器会话；毕业总结仅保存无原文的规则结果。清除浏览器数据会删除这些记录。
      </div>
      <button className={primaryButtonClass} onClick={onStart} type="button">
        我已了解规则，查看项目材料
      </button>
    </section>
  );
}

function ProjectDraft({
  assessment,
  error,
  onChange,
  onContinue,
  onSubmit,
  readOnly,
  value
}: {
  assessment: DaySevenAssessment | null;
  error: string | null;
  onChange(value: string): void;
  onContinue(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  readOnly: boolean;
  value: string;
}) {
  return (
    <section className="space-y-6">
      <AnswerForm
        error={error}
        label="你的毕业项目首稿"
        onChange={onChange}
        onSubmit={onSubmit}
        readOnly={readOnly}
        scenarioId="project"
        submitLabel="冻结首稿并查看证据"
        value={value}
      />
      {assessment ? (
        <ReportFeedback
          assessment={assessment}
          eyebrow={assessment.passed ? "首稿结构已达标" : "首稿已冻结 · 一次只改一个缺口"}
        >
          <button className={`${primaryButtonClass} mt-5`} onClick={onContinue} type="button">
            在原稿上完成一次修改
          </button>
        </ReportFeedback>
      ) : null}
    </section>
  );
}

function ProjectRevision({
  assessment,
  change,
  error,
  onChange,
  onContinue,
  onSubmit,
  original,
  value
}: {
  assessment: DaySevenAssessment | null;
  change: ReturnType<typeof evaluateDaySevenRevision> | null;
  error: string | null;
  onChange(value: string): void;
  onContinue(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  original: string;
  value: string;
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <p className="text-sm font-medium text-focus">Day 7 · 原稿修改</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          保留首稿，在原文上完成一次实质修改
        </h2>
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-500">已冻结的首稿</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{original}</p>
        </div>
        <form className="mt-5" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-800" htmlFor="day-seven-revision">
            修改稿（已为你预填首稿）
          </label>
          <textarea
            className={textareaClass}
            id="day-seven-revision"
            maxLength={600}
            onChange={(event) => onChange(event.target.value)}
            value={value}
          />
          <p className="mt-1 flex justify-between gap-3 text-xs text-slate-500">
            <span>至少重写一个完整句子；修改后仍需满足四项结构检查。</span>
            <span>{value.length} / 600</span>
          </p>
          <FormError message={error} />
          <button className={`${primaryButtonClass} mt-4`} type="submit">
            检查我的修改
          </button>
        </form>
      </div>
      {assessment && change ? (
        <ReportFeedback
          assessment={assessment}
          eyebrow={change.passed ? "主动修改证据成立" : "修改还不能进入迁移"}
          overrideAction={change.action}
          overrideObservation={change.observation}
          passed={change.passed}
          title={change.statusLabel}
        >
          {change.passed ? (
            <button className={`${primaryButtonClass} mt-5`} onClick={onContinue} type="button">
              进入第二个未见情境
            </button>
          ) : null}
        </ReportFeedback>
      ) : null}
    </section>
  );
}

function TransferPractice({
  assessment,
  error,
  onChange,
  onComplete,
  onSubmit,
  value
}: {
  assessment: DaySevenAssessment | null;
  error: string | null;
  onChange(value: string): void;
  onComplete(passed: boolean): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  value: string;
}) {
  return (
    <section className="space-y-6">
      <AnswerForm
        error={error}
        label="你的未见迁移回答"
        onChange={onChange}
        onSubmit={onSubmit}
        readOnly={false}
        scenarioId="transfer"
        submitLabel="检查未见迁移"
        value={value}
      />
      {assessment ? (
        <ReportFeedback
          assessment={assessment}
          eyebrow={assessment.passed ? "本次迁移达到冻结规则" : "本次迁移暂未达到规则"}
        >
          <div className="mt-5 flex flex-wrap gap-3">
            {assessment.passed ? (
              <button className={primaryButtonClass} onClick={() => onComplete(true)} type="button">
                完成七天课程
              </button>
            ) : (
              <>
                <p className="w-full text-sm leading-6 text-amber-950">
                  你可以直接修改后再次检查；首次结果不会被覆盖。也可以先结束课程，并把迁移标记为待加强。
                </p>
                <button className={secondaryButtonClass} onClick={() => onComplete(false)} type="button">
                  本次先结束，标记待加强
                </button>
              </>
            )}
          </div>
        </ReportFeedback>
      ) : null}
    </section>
  );
}

function AnswerForm({
  error,
  label,
  onChange,
  onSubmit,
  readOnly,
  scenarioId,
  submitLabel,
  value
}: {
  error: string | null;
  label: string;
  onChange(value: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  readOnly: boolean;
  scenarioId: "project" | "transfer";
  submitLabel: string;
  value: string;
}) {
  const scenario = daySevenScenarios[scenarioId];
  const inputId = `day-seven-${scenarioId}`;
  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" onSubmit={onSubmit}>
      <p className="text-sm font-medium text-focus">
        {scenarioId === "project" ? "Day 7 · 毕业项目首稿" : "Day 7 · 未见迁移"}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">{scenario.title}</h2>
      <p className="mt-2 text-sm text-slate-600">受众：{scenario.audience}</p>
      <div className="mt-5 rounded-xl bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-900">混排材料</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
          {scenario.facts.map((fact) => (
            <li key={fact}>• {fact}</li>
          ))}
        </ul>
        <p className="mt-4 border-t border-slate-200 pt-4 font-medium leading-7 text-slate-950">
          任务：{scenario.task}
        </p>
      </div>
      <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
        先用约 30 秒在心里规划，再独立写作。这里不显示提纲或参考答案。
      </p>
      <label className="mt-5 block text-sm font-medium text-slate-800" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        className={`${textareaClass} read-only:bg-slate-100 read-only:text-slate-600`}
        id={inputId}
        maxLength={600}
        onChange={(event) => onChange(event.target.value)}
        placeholder="请直接向题目中的负责人完成 4–6 句短汇报"
        readOnly={readOnly}
        value={value}
      />
      <p className="mt-1 flex justify-between gap-3 text-xs text-slate-500">
        <span>{readOnly ? "首稿已冻结，后续修改不会覆盖这份原文。" : "答案只保存在当前浏览器会话。"}</span>
        <span>{value.length} / 600</span>
      </p>
      <FormError message={error} />
      {!readOnly ? (
        <button className={`${primaryButtonClass} mt-4`} type="submit">
          {submitLabel}
        </button>
      ) : null}
    </form>
  );
}

function ReportFeedback({
  assessment,
  children,
  eyebrow,
  overrideAction,
  overrideObservation,
  passed,
  title
}: {
  assessment: DaySevenAssessment;
  children?: ReactNode;
  eyebrow: string;
  overrideAction?: string;
  overrideObservation?: string;
  passed?: boolean;
  title?: string;
}) {
  const tonePassed = passed ?? assessment.passed;
  return (
    <section
      aria-live="polite"
      className={
        tonePassed
          ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7"
          : "rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-7"
      }
    >
      <p className="text-sm font-medium">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-950">
        {title ?? assessment.statusLabel}
      </h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {assessment.checks.map((check) => (
          <li className="rounded-lg border border-white/80 bg-white/70 p-4 text-sm" key={check.id}>
            <p className="font-semibold text-slate-900">
              {check.passed ? "✓" : "待补"} {check.label}
            </p>
            <p className="mt-2 leading-6 text-slate-600">{check.evidence}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-5 space-y-3 text-sm leading-6">
        <FeedbackItem label="系统观察" value={overrideObservation ?? assessment.observation} />
        <FeedbackItem label="对负责人的影响" value={assessment.impact} />
        <FeedbackItem label="现在只改这一处" value={overrideAction ?? assessment.action} />
      </dl>
      {children}
    </section>
  );
}

function CourseEvidenceSummary({
  outcome,
  scaffoldUseCount
}: {
  outcome?: DaySevenOutcome;
  scaffoldUseCount: number;
}) {
  if (!outcome) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-xl font-semibold text-amber-950">毕业总结尚未生成</h2>
        <p className="mt-2 leading-7 text-amber-900">请从课程地图重新进入 Day 7 完成最后一步。</p>
      </section>
    );
  }
  const transferLabel = outcome.transferFirstPassed
    ? "首次未见迁移达到规则"
    : outcome.transferFinalPassed
      ? "首次未达标，修改后达到规则"
      : "本次未见迁移待加强";

  return (
    <section className="space-y-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-800">Day 7 已记录 · 7 / 7</p>
          <h2 className="mt-2 text-2xl font-semibold text-emerald-950">七天课程流程已完成</h2>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-900">零 AI 调用</span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <SummaryItem label="毕业项目首稿" value={outcome.projectInitialPassed ? "首次即达到规则" : "首次未达标，已保留"} />
        <SummaryItem label="主动修改" value={outcome.revisionKind === "improved" ? "实质修改并修复缺口" : "实质修改并保持完整"} />
        <SummaryItem label="未见迁移" value={transferLabel} />
        <SummaryItem label="练习过程" value={`修改检查 ${outcome.revisionAttempts} 次 · 迁移检查 ${outcome.transferAttempts} 次`} />
        <SummaryItem label="前六天支架" value={`共主动查看 ${scaffoldUseCount} 次`} />
        <SummaryItem label="规则版本" value={outcome.ruleVersion} />
      </dl>
      <div className="rounded-lg border border-amber-200 bg-white/70 p-4 text-sm leading-6 text-slate-700">
        这份总结只记录当前浏览器中的规则检查、修改行为和本次即时迁移。它不代表长期能力提升，也未证明本产品优于直接使用 AI；尚未检查 24–72 小时后的独立保持。
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/70 p-4">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-2 font-medium text-slate-950">{value}</dd>
    </div>
  );
}

function FeedbackItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-slate-700">{label}</dt>
      <dd className="mt-1 text-slate-900">{value}</dd>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  return message ? (
    <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
      {message}
    </p>
  ) : null;
}

const textareaClass =
  "mt-2 min-h-44 w-full rounded-md border border-slate-300 px-3 py-3 text-base leading-7 shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20";
const primaryButtonClass =
  "inline-flex rounded-md bg-focus px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2";
const secondaryButtonClass =
  "inline-flex rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2";
