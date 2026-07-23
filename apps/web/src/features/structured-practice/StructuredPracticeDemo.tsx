import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  getStructuredPracticeScenario,
  selectStructuredPracticePrompt,
  structuredPracticeScenarios
} from "@/features/structured-practice/curriculum";
import {
  evaluateRevisionChange,
  evaluateStructuredAnswer
} from "@/features/structured-practice/ruleEngine";
import {
  completeDelayedPractice,
  findDuePractice,
  getStructuredSkillProgress,
  scheduleDelayedPractice
} from "@/features/structured-practice/progress";
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
  | "complete"
  | "delayed_draft"
  | "delayed_self_check"
  | "delayed_complete";

type PracticeSessionSnapshot = {
  skillId: StructuredSkillId;
  stage: PracticeStage;
  draft: string;
  coreStatement: string;
  draftAssessment: SkillAssessment | null;
  revision: string;
  revisionAssessment: SkillAssessment | null;
  revisionChange: ReturnType<typeof evaluateRevisionChange> | null;
  transferAnswer: string;
  transferCoreStatement: string;
  transferAssessment: SkillAssessment | null;
  dueRecordId: string | null;
  delayedAnswer: string;
  delayedCoreStatement: string;
  delayedAssessment: SkillAssessment | null;
};

const PROGRESS_KEY = "stg:v0.4:structured-practice-progress";
const SESSION_KEY = "stg:v0.4:structured-practice-session";
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
  const [dueRecordId, setDueRecordId] = useState<string | null>(null);
  const [delayedAnswer, setDelayedAnswer] = useState("");
  const [delayedCoreStatement, setDelayedCoreStatement] = useState("");
  const [delayedAssessment, setDelayedAssessment] =
    useState<SkillAssessment | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [records, setRecords] = useState<StructuredPracticeRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [revisionChange, setRevisionChange] = useState<ReturnType<
    typeof evaluateRevisionChange
  > | null>(null);

  const scenario = useMemo(
    () => getStructuredPracticeScenario(skillId),
    [skillId]
  );
  const usedPromptIds = useMemo(
    () =>
      records
        .filter((record) => record.skillId === skillId)
        .flatMap((record) => [
          record.coldPromptId,
          record.transferPromptId,
          record.delayedPromptId
        ])
        .filter((promptId): promptId is string => Boolean(promptId)),
    [records, skillId]
  );
  const coldPrompt = useMemo(
    () =>
      selectStructuredPracticePrompt({
        skillId,
        kinds: ["cold"],
        excludedPromptIds: usedPromptIds
      }),
    [skillId, usedPromptIds]
  );
  const transferPrompt = useMemo(
    () =>
      selectStructuredPracticePrompt({
        skillId,
        kinds: ["near_transfer", "far_transfer"],
        excludedPromptIds: usedPromptIds
      }),
    [skillId, usedPromptIds]
  );
  const dueRecord = useMemo(() => findDuePractice(records), [records]);
  const activeDueRecord = useMemo(
    () => records.find((record) => record.id === dueRecordId),
    [dueRecordId, records]
  );
  const delayedPrompt = useMemo(
    () =>
      selectStructuredPracticePrompt({
        skillId: activeDueRecord?.skillId ?? skillId,
        kinds: ["delayed"],
        excludedPromptIds: usedPromptIds
      }),
    [activeDueRecord?.skillId, skillId, usedPromptIds]
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PROGRESS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StructuredPracticeRecord[];
        if (Array.isArray(parsed)) {
          setRecords(
            parsed
              .filter((record) => record?.version === 2)
              .slice(-30)
          );
        }
      }
    } catch {
      // A broken local record must never block a practice session.
    }
    try {
      const storedSession = window.sessionStorage.getItem(SESSION_KEY);
      if (storedSession) {
        const parsed = JSON.parse(storedSession) as PracticeSessionSnapshot;
        if (
          isPracticeStage(parsed.stage) &&
          isStructuredSkill(parsed.skillId) &&
          parsed.stage !== "complete" &&
          parsed.stage !== "delayed_complete"
        ) {
          setSkillId(parsed.skillId);
          setStage(parsed.stage);
          setDraft(parsed.draft ?? "");
          setCoreStatement(parsed.coreStatement ?? "");
          setDraftAssessment(parsed.draftAssessment ?? null);
          setRevision(parsed.revision ?? "");
          setRevisionAssessment(parsed.revisionAssessment ?? null);
          setRevisionChange(parsed.revisionChange ?? null);
          setTransferAnswer(parsed.transferAnswer ?? "");
          setTransferCoreStatement(parsed.transferCoreStatement ?? "");
          setTransferAssessment(parsed.transferAssessment ?? null);
          setDueRecordId(parsed.dueRecordId ?? null);
          setDelayedAnswer(parsed.delayedAnswer ?? "");
          setDelayedCoreStatement(parsed.delayedCoreStatement ?? "");
          setDelayedAssessment(parsed.delayedAssessment ?? null);
        } else {
          window.sessionStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot: PracticeSessionSnapshot = {
      skillId,
      stage,
      draft,
      coreStatement,
      draftAssessment,
      revision,
      revisionAssessment,
      revisionChange,
      transferAnswer,
      transferCoreStatement,
      transferAssessment,
      dueRecordId,
      delayedAnswer,
      delayedCoreStatement,
      delayedAssessment
    };
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
    } catch {
      // Session recovery is optional and never uploads the answer.
    }
  }, [
    coreStatement,
    draft,
    draftAssessment,
    dueRecordId,
    delayedAnswer,
    delayedAssessment,
    delayedCoreStatement,
    hydrated,
    revision,
    revisionAssessment,
    revisionChange,
    skillId,
    stage,
    transferAnswer,
    transferAssessment,
    transferCoreStatement
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <section className="space-y-3">
        <p className="text-sm font-medium text-focus">免费公开训练 · 第 0.4 版</p>
        <h1 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
          五分钟结构化表达训练
        </h1>
        <p className="max-w-3xl text-base leading-7 text-slate-600">
          先完成一次无提示回答，再看一个最重要的问题，亲自重写，并用新情境检验自己是否真的会用。
          所有分析都在当前浏览器中完成，不调用外部模型或数据库。
        </p>
        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">
            当前浏览器已完成 {records.length} 次训练闭环
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            其中 {records.filter((record) => record.skillMet).length} 次迁移达标
          </span>
        </div>
        <div
          aria-label="三天训练状态"
          className="grid gap-2 pt-1 sm:grid-cols-3"
        >
          {structuredPracticeScenarios.map((item) => {
            const progress = getStructuredSkillProgress(
              records,
              item.skillId
            );
            return (
              <div
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                key={item.id}
              >
                <span className="text-slate-500">第 {item.day} 天</span>
                <span className="ml-2 font-medium text-slate-900">
                  {skillProgressLabels[progress]}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {stage.startsWith("delayed") ? (
        <DelayedStepIndicator stage={stage} />
      ) : (
        <StepIndicator stage={stage} />
      )}

      {stage === "draft" && dueRecord ? (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-5 sm:p-6">
          <p className="text-sm font-medium text-violet-700">今日冷测已到期</p>
          <h2 className="mt-2 text-xl font-semibold text-violet-950">
            先不看方法，检验 24 小时后的独立使用
          </h2>
          <p className="mt-2 text-sm leading-6 text-violet-900">
            这是间隔练习，不会把智能体模拟或单次结果称为稳定能力。
          </p>
          <button
            className={`${primaryButtonClass} mt-4`}
            onClick={() => startDelayedPractice(dueRecord)}
            type="button"
          >
            开始今日冷测
          </button>
        </section>
      ) : null}

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
            audience={coldPrompt.audience}
            desiredOutcome={coldPrompt.desiredOutcome}
            prompt={coldPrompt.prompt}
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
              {revisionChange ? (
                <p
                  className={
                    revisionChange.canContinue
                      ? "rounded-md bg-emerald-50 p-4 text-sm text-emerald-800"
                      : "rounded-md bg-amber-50 p-4 text-sm text-amber-800"
                  }
                  role="status"
                >
                  {revisionChange.message}
                </p>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <AnswerSnapshot answer={draft} title="原始回答" />
                <AnswerSnapshot answer={revision} title="我的重写" />
              </div>
              {revisionChange?.canContinue ? (
                <button
                  className={primaryButtonClass}
                  onClick={startTransfer}
                  type="button"
                >
                  进入迁移练习
                </button>
              ) : null}
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
            audience={transferPrompt.audience}
            desiredOutcome={transferPrompt.desiredOutcome}
            prompt={transferPrompt.prompt}
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

      {stage === "delayed_draft" ? (
        <section className="space-y-6">
          <section className="rounded-xl border border-violet-200 bg-violet-50 p-5 sm:p-6">
            <p className="text-sm font-medium text-violet-700">24 小时间隔冷测</p>
            <h2 className="mt-2 text-2xl font-semibold text-violet-950">
              不查看方法，直接完成新的工作情境
            </h2>
            <p className="mt-2 text-sm leading-6 text-violet-900">
              本次只记录间隔后的规则表现，不把一次结果称为完整能力。
            </p>
          </section>
          <ScenarioCard
            audience={delayedPrompt.audience}
            desiredOutcome={delayedPrompt.desiredOutcome}
            prompt={delayedPrompt.prompt}
            title="今日冷测"
          />
          <AnswerForm
            error={validationError}
            label="你的冷测回答"
            onChange={(value) => updateText(setDelayedAnswer, value)}
            onSubmit={submitDelayedDraft}
            submitLabel="提交冷测回答"
            value={delayedAnswer}
          />
        </section>
      ) : null}

      {stage === "delayed_self_check" ? (
        <section className="space-y-6">
          <AnswerSnapshot answer={delayedAnswer} title="刚才的冷测回答" />
          <form
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
            onSubmit={finishDelayedPractice}
          >
            <p className="text-sm font-medium text-focus">不查看方法，最后自检一次</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              这次回答真正要让对方知道或决定什么？
            </h2>
            <label
              className="mt-5 block text-sm font-medium text-slate-800"
              htmlFor="delayed-core-statement"
            >
              冷测核心结论
            </label>
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              id="delayed-core-statement"
              maxLength={CORE_MAX_LENGTH}
              onChange={(event) =>
                updateText(setDelayedCoreStatement, event.target.value)
              }
              value={delayedCoreStatement}
            />
            <CharacterCount
              current={delayedCoreStatement.length}
              max={CORE_MAX_LENGTH}
            />
            <FormError message={validationError} />
            <button className={primaryButtonClass} type="submit">
              检查冷测结果
            </button>
          </form>
        </section>
      ) : null}

      {stage === "delayed_complete" && delayedAssessment ? (
        <section className="space-y-6">
          <AssessmentCard assessment={delayedAssessment} title="间隔冷测结果" />
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-slate-500">本次真实记录</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              {delayedAssessment.status === "met"
                ? "间隔后仍在新情境中做到"
                : "已完成冷测，仍需要继续巩固"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              “初步稳定”只表示两个不同场景中至少包含一次间隔冷测达标，不代表完整沟通能力。
            </p>
            <button
              className={`${primaryButtonClass} mt-5`}
              onClick={finishDelayedAndReturn}
              type="button"
            >
              返回日常训练
            </button>
          </section>
        </section>
      ) : null}

      {stage === "complete" && transferAssessment && revisionAssessment ? (
        <section className="space-y-6">
          <AssessmentCard assessment={transferAssessment} title="迁移结果" />
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <p className="text-sm font-medium text-slate-500">本次行为记录</p>
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
              完成闭环与规则达标是两件事。系统将在 24 小时后安排未见冷测；单次通过不代表已经形成稳定能力。
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
      selfStatement: coreStatement,
      evaluation: coldPrompt.evaluation
    });
    setDraftAssessment(assessment);
    setRevision(draft);
    setValidationError(null);
    setStage("feedback");
  }

  function submitRevision() {
    if (!validateAnswer(revision)) return;
    if (!draftAssessment) return;
    const nextAssessment = evaluateStructuredAnswer({
      skillId,
      answer: revision,
      selfStatement: coreStatement,
      evaluation: coldPrompt.evaluation
    });
    const change = evaluateRevisionChange({
      beforeAnswer: draft,
      afterAnswer: revision,
      before: draftAssessment,
      after: nextAssessment
    });
    setRevisionAssessment(nextAssessment);
    setRevisionChange(change);
    setValidationError(change.canContinue ? null : change.message);
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
      selfStatement: transferCoreStatement,
      evaluation: transferPrompt.evaluation
    });
    setTransferAssessment(assessment);
    saveRecord(assessment);
    setValidationError(null);
    setStage("complete");
  }

  function saveRecord(assessment: SkillAssessment) {
    const completedAt = new Date().toISOString();
    const record: StructuredPracticeRecord = {
      version: 2,
      id: `${scenario.id}:${Date.now()}`,
      completedAt,
      dueAt: scheduleDelayedPractice(completedAt),
      scenarioId: scenario.id,
      coldPromptId: coldPrompt.id,
      transferPromptId: transferPrompt.id,
      skillId,
      sessionCompleted: true,
      skillMet: assessment.status === "met",
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

  function startDelayedPractice(record: StructuredPracticeRecord) {
    resetPractice();
    setSkillId(record.skillId);
    setDueRecordId(record.id);
    setStage("delayed_draft");
  }

  function submitDelayedDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateAnswer(delayedAnswer)) return;
    setValidationError(null);
    setStage("delayed_self_check");
  }

  function finishDelayedPractice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCoreStatement(delayedCoreStatement) || !dueRecordId) return;
    const assessment = evaluateStructuredAnswer({
      skillId,
      answer: delayedAnswer,
      selfStatement: delayedCoreStatement,
      evaluation: delayedPrompt.evaluation
    });
    setDelayedAssessment(assessment);
    setRecords((current) => {
      const next = completeDelayedPractice({
        records: current,
        recordId: dueRecordId,
        promptId: delayedPrompt.id,
        status: assessment.status
      });
      try {
        window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // The delayed result remains visible even when persistence is unavailable.
      }
      return next;
    });
    setValidationError(null);
    setStage("delayed_complete");
  }

  function finishDelayedAndReturn() {
    resetPractice();
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
    setRevisionChange(null);
    setTransferAnswer("");
    setTransferCoreStatement("");
    setTransferAssessment(null);
    setDueRecordId(null);
    setDelayedAnswer("");
    setDelayedCoreStatement("");
    setDelayedAssessment(null);
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

function DelayedStepIndicator({ stage }: { stage: PracticeStage }) {
  const activeIndex =
    stage === "delayed_draft"
      ? 0
      : stage === "delayed_self_check"
        ? 1
        : 2;
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="冷测进度">
      {["间隔冷答", "自我检查", "冷测结果"].map((label, index) => (
        <li
          className={
            index <= activeIndex
              ? "rounded-md bg-violet-600 px-2 py-2 text-center text-xs font-medium text-white"
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
        <FeedbackRow label="任务完成" value={assessment.taskStatusLabel} />
        <FeedbackRow label="自我检查" value={assessment.selfCheckLabel} />
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

function isPracticeStage(value: unknown): value is PracticeStage {
  return [
    "draft",
    "self_check",
    "feedback",
    "transfer_draft",
    "transfer_self_check",
    "complete",
    "delayed_draft",
    "delayed_self_check",
    "delayed_complete"
  ].includes(String(value));
}

function isStructuredSkill(value: unknown): value is StructuredSkillId {
  return ["purpose", "conclusion_first", "grouping"].includes(String(value));
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
  complete: 3,
  delayed_draft: 0,
  delayed_self_check: 0,
  delayed_complete: 3
};

const statusClasses: Record<SkillAssessmentStatus, string> = {
  met: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  needs_work: "bg-rose-100 text-rose-800",
  uncertain: "bg-slate-200 text-slate-800"
};

const statusSummaryLabels: Record<SkillAssessmentStatus, string> = {
  met: "已做到",
  partial: "已经接近",
  needs_work: "需要继续练",
  uncertain: "规则无法确定"
};

const skillProgressLabels = {
  not_started: "未练习",
  practicing: "练习中",
  due: "待冷测",
  initially_stable: "初步稳定"
} as const;
