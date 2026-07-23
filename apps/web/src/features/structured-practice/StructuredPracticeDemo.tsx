import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  getStructuredPracticeScenario,
  structuredPracticeScenarios
} from "@/features/structured-practice/curriculum";
import { evaluateStructuredAnswer } from "@/features/structured-practice/ruleEngine";
import type {
  SkillAssessment,
  SkillAssessmentStatus,
  StructuredPracticeRecord,
  StructuredSkillId
} from "@/features/structured-practice/types";

type PracticeStage =
  | "draft"
  | "self_check"
  | "feedback"
  | "transfer_draft"
  | "transfer_self_check"
  | "complete";

const PROGRESS_KEY = "stg:v0.3:structured-practice-progress";
const ANSWER_MIN_LENGTH = 20;
const ANSWER_MAX_LENGTH = 600;
const CORE_MIN_LENGTH = 4;
const CORE_MAX_LENGTH = 60;

export function StructuredPracticeDemo() {
  const [skillId, setSkillId] = useState<StructuredSkillId>("purpose");
  const [stage, setStage] = useState<PracticeStage>("draft");
  const [draft, setDraft] = useState("");
  const [coreStatement, setCoreStatement] = useState("");
  const [draftAssessment, setDraftAssessment] =
    useState<SkillAssessment | null>(null);
  const [revision, setRevision] = useState("");
  const [revisionAssessment, setRevisionAssessment] =
    useState<SkillAssessment | null>(null);
  const [transferAnswer, setTransferAnswer] = useState("");
  const [transferCoreStatement, setTransferCoreStatement] = useState("");
  const [transferAssessment, setTransferAssessment] =
    useState<SkillAssessment | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [records, setRecords] = useState<StructuredPracticeRecord[]>([]);

  const scenario = useMemo(
    () => getStructuredPracticeScenario(skillId),
    [skillId]
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PROGRESS_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as StructuredPracticeRecord[];
      if (Array.isArray(parsed)) setRecords(parsed.slice(-30));
    } catch {
      // A broken local record must never block a practice session.
    }
  }, []);

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-medium text-focus">免费公开训练 · 第 0.3 版</p>
        <h1 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
          五分钟结构化表达训练
        </h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          先完成一次无提示回答，再看一个最重要的问题，亲自重写，并用新情境检验自己是否真的会用。
          所有分析都在当前浏览器中完成，不调用外部模型或数据库。
        </p>
        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">
            当前浏览器已完成 {records.length} 次迁移练习
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            不使用百分制能力评分
          </span>
        </div>
      </section>

      <StepIndicator stage={stage} />

      {stage === "draft" ? (
        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">
              选择今天的训练
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              作答前不展示方法提示，避免把照着提示写误认为已经掌握。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {structuredPracticeScenarios.map((item) => (
                <button
                  aria-pressed={skillId === item.skillId}
                  className={
                    skillId === item.skillId
                      ? "rounded-lg border border-focus bg-blue-50 p-4 text-left text-focus"
                      : "rounded-lg border border-slate-200 bg-white p-4 text-left text-slate-700 hover:border-slate-300"
                  }
                  key={item.id}
                  onClick={() => changeSkill(item.skillId)}
                  type="button"
                >
                  <span className="block text-sm font-medium">第 {item.day} 天</span>
                  <span className="mt-1 block font-semibold">职场短答</span>
                </button>
              ))}
            </div>
          </div>

          <ScenarioCard
            audience={scenario.audience}
            desiredOutcome={scenario.desiredOutcome}
            prompt={scenario.prompt}
            title={`第 ${scenario.day} 天 · 无提示回答`}
          />

          <AnswerForm
            error={validationError}
            label="你的无提示回答"
            onChange={(value) => updateText(setDraft, value)}
            onSubmit={submitDraft}
            submitLabel="提交冷回答"
            value={draft}
          />
        </section>
      ) : null}

      {stage === "self_check" ? (
        <section className="space-y-6">
          <AnswerSnapshot answer={draft} title="刚才的回答" />
          <form
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
            onSubmit={submitSelfCheck}
          >
            <p className="text-sm font-medium text-focus">先自己检查</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              用一句话写下你真正想让对方知道或决定的内容
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              这不是重写回答。它帮助你确认刚才的文字有没有承载真正的核心意思。
            </p>
            <label
              className="mt-5 block text-sm font-medium text-slate-800"
              htmlFor="core-statement"
            >
              我的核心结论
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              id="core-statement"
              maxLength={CORE_MAX_LENGTH}
              onChange={(event) => updateText(setCoreStatement, event.target.value)}
              placeholder="例如：项目存在延期风险，需要今天决定是否调整发布日期。"
              value={coreStatement}
            />
            <CharacterCount current={coreStatement.length} max={CORE_MAX_LENGTH} />
            <FormError message={validationError} />
            <button className={primaryButtonClass} type="submit">
              查看单点反馈
            </button>
          </form>
        </section>
      ) : null}

      {stage === "feedback" && draftAssessment ? (
        <section className="space-y-6">
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
            <p className="text-sm font-medium text-blue-700">
              第 {scenario.day} 天方法
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-blue-950">
              {scenario.title}
            </h2>
            <p className="mt-2 leading-7 text-blue-950">
              {scenario.lesson.principle}
            </p>
          </section>

          <AssessmentCard assessment={draftAssessment} title="本次只改一个问题" />

          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-slate-500">方法检查表</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {scenario.lesson.checklist.map((item) => (
                <li className="flex gap-2" key={item}>
                  <span aria-hidden="true" className="text-focus">
                    ○
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-focus">现在由你重写</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              不提供一键采用，请亲自完成修改
            </h2>
            <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p className="font-medium text-slate-900">你的核心结论</p>
              <p className="mt-1">{coreStatement}</p>
            </div>
            <label
              className="mt-5 block text-sm font-medium text-slate-800"
              htmlFor="revision-answer"
            >
              亲自重写
            </label>
            <textarea
              className="mt-2 min-h-40 w-full rounded-md border border-slate-300 px-3 py-3 text-base leading-7 shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              id="revision-answer"
              maxLength={ANSWER_MAX_LENGTH}
              onChange={(event) => updateText(setRevision, event.target.value)}
              value={revision}
            />
            <CharacterCount current={revision.length} max={ANSWER_MAX_LENGTH} />
            <FormError message={validationError} />
            <button
              className={primaryButtonClass}
              onClick={submitRevision}
              type="button"
            >
              检查我的重写
            </button>
          </section>

          {revisionAssessment ? (
            <section className="space-y-6" aria-live="polite">
              <AssessmentCard assessment={revisionAssessment} title="重写结果" />
              <div className="grid gap-4 md:grid-cols-2">
                <AnswerSnapshot answer={draft} title="原始回答" />
                <AnswerSnapshot answer={revision} title="我的重写" />
              </div>
              <button
                className={primaryButtonClass}
                onClick={startTransfer}
                type="button"
              >
                进入迁移练习
              </button>
            </section>
          ) : null}
        </section>
      ) : null}

      {stage === "transfer_draft" ? (
        <section className="space-y-6">
          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <p className="text-sm font-medium text-emerald-700">新情境 · 不再提示方法</p>
            <h2 className="mt-2 text-2xl font-semibold text-emerald-950">
              检验你能否自己再次使用
            </h2>
          </section>
          <ScenarioCard
            audience={scenario.transferAudience}
            desiredOutcome={scenario.transferDesiredOutcome}
            prompt={scenario.transferPrompt}
            title="迁移题"
          />
          <AnswerForm
            error={validationError}
            label="你的迁移回答"
            onChange={(value) => updateText(setTransferAnswer, value)}
            onSubmit={submitTransferDraft}
            submitLabel="提交迁移回答"
            value={transferAnswer}
          />
        </section>
      ) : null}

      {stage === "transfer_self_check" ? (
        <section className="space-y-6">
          <AnswerSnapshot answer={transferAnswer} title="迁移回答" />
          <form
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
            onSubmit={finishTransfer}
          >
            <p className="text-sm font-medium text-focus">最后一次自检</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              这次回答的核心结论是什么？
            </h2>
            <label
              className="mt-5 block text-sm font-medium text-slate-800"
              htmlFor="transfer-core-statement"
            >
              迁移题核心结论
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              id="transfer-core-statement"
              maxLength={CORE_MAX_LENGTH}
              onChange={(event) =>
                updateText(setTransferCoreStatement, event.target.value)
              }
              value={transferCoreStatement}
            />
            <CharacterCount
              current={transferCoreStatement.length}
              max={CORE_MAX_LENGTH}
            />
            <FormError message={validationError} />
            <button className={primaryButtonClass} type="submit">
              检查迁移结果
            </button>
          </form>
        </section>
      ) : null}

      {stage === "complete" && transferAssessment && revisionAssessment ? (
        <section className="space-y-6">
          <AssessmentCard assessment={transferAssessment} title="迁移结果" />
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-slate-500">本次掌握证据</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              {transferAssessment.status === "met"
                ? "已在新情境中独立使用"
                : "还需要再换一个情境练习"}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatusSummary label="冷回答" status={draftAssessment?.status ?? "needs_work"} />
              <StatusSummary label="亲自重写" status={revisionAssessment.status} />
              <StatusSummary label="新题迁移" status={transferAssessment.status} />
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600">
              单次通过不等于已经形成能力。后续版本会在次日安排一次无提示回忆，连续两个不同场景成功后才标记为掌握。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className={primaryButtonClass} onClick={repeatSkill} type="button">
                再练同一方法
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800"
                onClick={startNextDay}
                type="button"
              >
                进入下一天
              </button>
            </div>
          </section>
        </section>
      ) : null}

      <section className="rounded-lg bg-slate-100 p-4 text-xs leading-5 text-slate-600">
        本课程参考结构化表达中的通用原则重新设计，未复制书中案例或原文；训练结果只代表当前规则表现，不代表完整沟通能力。
      </section>
    </main>
  );

  function changeSkill(nextSkillId: StructuredSkillId) {
    setSkillId(nextSkillId);
    resetPractice();
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateAnswer(draft)) return;
    setValidationError(null);
    setStage("self_check");
  }

  function submitSelfCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCoreStatement(coreStatement)) return;
    const assessment = evaluateStructuredAnswer({
      skillId,
      answer: draft,
      coreStatement
    });
    setDraftAssessment(assessment);
    setRevision(draft);
    setValidationError(null);
    setStage("feedback");
  }

  function submitRevision() {
    if (!validateAnswer(revision)) return;
    if (normalize(revision) === normalize(draft)) {
      setValidationError("请根据反馈至少修改一处，再检查重写结果。");
      return;
    }
    setRevisionAssessment(
      evaluateStructuredAnswer({ skillId, answer: revision, coreStatement })
    );
    setValidationError(null);
  }

  function startTransfer() {
    setValidationError(null);
    setStage("transfer_draft");
  }

  function submitTransferDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateAnswer(transferAnswer)) return;
    setValidationError(null);
    setStage("transfer_self_check");
  }

  function finishTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCoreStatement(transferCoreStatement)) return;
    const assessment = evaluateStructuredAnswer({
      skillId,
      answer: transferAnswer,
      coreStatement: transferCoreStatement
    });
    setTransferAssessment(assessment);
    saveRecord(assessment);
    setValidationError(null);
    setStage("complete");
  }

  function saveRecord(assessment: SkillAssessment) {
    const record: StructuredPracticeRecord = {
      id: `${scenario.id}:${Date.now()}`,
      completedAt: new Date().toISOString(),
      scenarioId: scenario.id,
      skillId,
      draftStatus: draftAssessment?.status ?? "needs_work",
      revisionStatus: revisionAssessment?.status ?? "needs_work",
      transferStatus: assessment.status
    };

    setRecords((current) => {
      const next = [...current, record].slice(-30);
      try {
        window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // Progress persistence is optional; completing the session is not.
      }
      return next;
    });
  }

  function repeatSkill() {
    resetPractice();
  }

  function startNextDay() {
    const currentIndex = structuredPracticeScenarios.findIndex(
      (item) => item.skillId === skillId
    );
    const next = structuredPracticeScenarios[
      (currentIndex + 1) % structuredPracticeScenarios.length
    ];
    if (next) setSkillId(next.skillId);
    resetPractice();
  }

  function resetPractice() {
    setStage("draft");
    setDraft("");
    setCoreStatement("");
    setDraftAssessment(null);
    setRevision("");
    setRevisionAssessment(null);
    setTransferAnswer("");
    setTransferCoreStatement("");
    setTransferAssessment(null);
    setValidationError(null);
  }

  function validateAnswer(value: string) {
    const length = value.trim().length;
    if (length < ANSWER_MIN_LENGTH) {
      setValidationError(`请至少输入 ${ANSWER_MIN_LENGTH} 个字符后再提交。`);
      return false;
    }
    if (length > ANSWER_MAX_LENGTH) {
      setValidationError(`回答不能超过 ${ANSWER_MAX_LENGTH} 个字符。`);
      return false;
    }
    return true;
  }

  function validateCoreStatement(value: string) {
    const length = value.trim().length;
    if (length < CORE_MIN_LENGTH) {
      setValidationError(`核心结论请至少输入 ${CORE_MIN_LENGTH} 个字符。`);
      return false;
    }
    if (length > CORE_MAX_LENGTH) {
      setValidationError(`核心结论不能超过 ${CORE_MAX_LENGTH} 个字符。`);
      return false;
    }
    return true;
  }

  function updateText(
    setter: (value: string) => void,
    value: string
  ) {
    setter(value);
    setValidationError(null);
  }
}

function StepIndicator({ stage }: { stage: PracticeStage }) {
  const activeIndex = stageIndex[stage];
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="训练进度">
      {stepLabels.map((label, index) => (
        <li
          className={
            index <= activeIndex
              ? "rounded-md bg-focus px-2 py-2 text-center text-xs font-medium text-white"
              : "rounded-md bg-slate-200 px-2 py-2 text-center text-xs text-slate-500"
          }
          key={label}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

function ScenarioCard({
  audience,
  desiredOutcome,
  prompt,
  title
}: {
  audience: string;
  desiredOutcome: string;
  prompt: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <p className="text-sm font-medium text-focus">{title}</p>
      <h2 className="mt-2 text-xl font-semibold leading-8 text-slate-950">
        {prompt}
      </h2>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-medium text-slate-500">沟通对象</dt>
          <dd className="mt-1 text-sm text-slate-900">{audience}</dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-medium text-slate-500">现实任务</dt>
          <dd className="mt-1 text-sm text-slate-900">{desiredOutcome}</dd>
        </div>
      </dl>
    </section>
  );
}

function AnswerForm({
  error,
  label,
  onChange,
  onSubmit,
  submitLabel,
  value
}: {
  error: string | null;
  label: string;
  onChange(value: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  submitLabel: string;
  value: string;
}) {
  return (
    <form
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
      onSubmit={onSubmit}
    >
      <label className="block text-sm font-medium text-slate-800" htmlFor="practice-answer">
        {label}
      </label>
      <textarea
        className="mt-2 min-h-44 w-full rounded-md border border-slate-300 px-3 py-3 text-base leading-7 shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
        id="practice-answer"
        maxLength={ANSWER_MAX_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        placeholder="请按你平时真实的表达方式回答，不需要先润色。"
        value={value}
      />
      <CharacterCount current={value.length} max={ANSWER_MAX_LENGTH} />
      <FormError message={error} />
      <button className={primaryButtonClass} type="submit">
        {submitLabel}
      </button>
    </form>
  );
}

function AssessmentCard({
  assessment,
  title
}: {
  assessment: SkillAssessment;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        <StatusPill status={assessment.status} label={assessment.statusLabel} />
      </div>
      <dl className="mt-5 space-y-4 text-sm leading-6">
        <FeedbackRow label="原文证据" value={assessment.evidence} />
        <FeedbackRow label="观察" value={assessment.observation} />
        <FeedbackRow label="对听众的影响" value={assessment.impact} />
        <FeedbackRow label="只做这一个动作" value={assessment.action} emphasized />
      </dl>
    </section>
  );
}

function FeedbackRow({
  emphasized = false,
  label,
  value
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className={emphasized ? "rounded-md bg-blue-50 p-4" : ""}>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-900">{value}</dd>
    </div>
  );
}

function AnswerSnapshot({ answer, title }: { answer: string; title: string }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-900">
        {answer}
      </p>
    </section>
  );
}

function StatusPill({
  label,
  status
}: {
  label: string;
  status: SkillAssessmentStatus;
}) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusClasses[status]}`}>
      {label}
    </span>
  );
}

function StatusSummary({
  label,
  status
}: {
  label: string;
  status: SkillAssessmentStatus;
}) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {statusSummaryLabels[status]}
      </p>
    </div>
  );
}

function CharacterCount({ current, max }: { current: number; max: number }) {
  return (
    <p className="mt-1 text-right text-xs text-slate-500">
      {current} / {max}
    </p>
  );
}

function FormError({ message }: { message: string | null }) {
  return message ? (
    <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
      {message}
    </p>
  ) : null;
}

function normalize(value: string) {
  return value.replace(/\s+/g, "").trim();
}

const primaryButtonClass =
  "rounded-md bg-focus px-5 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-focus/30 focus:ring-offset-2";

const stepLabels = ["无提示回答", "单点反馈", "亲自重写", "新题迁移"];

const stageIndex: Record<PracticeStage, number> = {
  draft: 0,
  self_check: 0,
  feedback: 2,
  transfer_draft: 3,
  transfer_self_check: 3,
  complete: 3
};

const statusClasses: Record<SkillAssessmentStatus, string> = {
  met: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  needs_work: "bg-rose-100 text-rose-800"
};

const statusSummaryLabels: Record<SkillAssessmentStatus, string> = {
  met: "已做到",
  partial: "已经接近",
  needs_work: "需要继续练"
};
