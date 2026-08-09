"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  dayFiveGroupingExercise,
  dayFourGuidedExercise,
  dayFourIndependentPrompt,
  daySixGuidedExercise,
  daySixIndependentPrompt,
  dayThreeOrderExercise,
  getProgressiveLesson,
  progressiveCourse
} from "@/features/progressive-course/curriculum";
import { DaySevenProject } from "@/features/progressive-course/DaySevenProject";
import { DAY_SEVEN_RULE_VERSION } from "@/features/progressive-course/projectEvaluator";
import {
  completeDaySevenProject,
  completeProgressiveDay,
  createProgressiveCourseProgress,
  createProgressiveCourseSession,
  isProgressiveDayUnlocked,
  markProgressiveLessonViewed,
  parseProgressiveCourseProgress,
  parseProgressiveCourseSession,
  PROGRESSIVE_COURSE_KEY,
  PROGRESSIVE_DAY_SEVEN_SESSION_KEY,
  PROGRESSIVE_SESSION_KEY,
  recordProgressiveScaffoldUse,
  type ProgressiveCourseSession
} from "@/features/progressive-course/progress";
import { evaluateDaySixReport } from "@/features/progressive-course/reportEvaluator";
import type {
  DaySevenOutcome,
  KnowledgeCheck,
  ProgressiveCourseDay,
  ProgressiveCourseProgress,
  ProgressiveLessonContent
} from "@/features/progressive-course/types";
import { evaluateDayFourAnswer } from "@/features/progressive-course/supportEvaluator";
import { getStructuredPracticePrompt } from "@/features/structured-practice/curriculum";
import { evaluateStructuredAnswer } from "@/features/structured-practice/ruleEngine";

const dayTwoPracticePrompt = getStructuredPracticePrompt(
  "stg-v04-purpose-cold-02"
);
const dayThreePracticePrompt = getStructuredPracticePrompt(
  "stg-v04-conclusion-cold-01"
);
const dayFivePracticePrompt = getStructuredPracticePrompt(
  "stg-v04-grouping-cold-01"
);
const implementedDays: ProgressiveCourseDay[] = [1, 2, 3, 4, 5, 6, 7];

type CheckResult = "success" | "retry" | null;

export function ProgressiveTrainingDemo({
  classicHref = "/training-demo/classic"
}: {
  classicHref?: string;
} = {}) {
  const [progress, setProgress] = useState<ProgressiveCourseProgress>(() =>
    createProgressiveCourseProgress()
  );
  const [session, setSession] = useState<ProgressiveCourseSession>(() =>
    createProgressiveCourseSession()
  );
  const [hydrated, setHydrated] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dayOneResult, setDayOneResult] = useState<CheckResult>(null);
  const [dayTwoKnowledgeResult, setDayTwoKnowledgeResult] =
    useState<CheckResult>(null);
  const [dayTwoGuidedResult, setDayTwoGuidedResult] =
    useState<CheckResult>(null);
  const [dayThreeKnowledgeResult, setDayThreeKnowledgeResult] =
    useState<CheckResult>(null);
  const [dayThreeOrderResult, setDayThreeOrderResult] =
    useState<CheckResult>(null);
  const [dayFourKnowledgeResult, setDayFourKnowledgeResult] =
    useState<CheckResult>(null);
  const [dayFourGuidedResult, setDayFourGuidedResult] =
    useState<CheckResult>(null);
  const [dayFiveKnowledgeResult, setDayFiveKnowledgeResult] =
    useState<CheckResult>(null);
  const [dayFiveGroupingResult, setDayFiveGroupingResult] =
    useState<CheckResult>(null);
  const [daySixKnowledgeResult, setDaySixKnowledgeResult] =
    useState<CheckResult>(null);
  const [daySixGuidedResult, setDaySixGuidedResult] =
    useState<CheckResult>(null);

  const currentLesson = getProgressiveLesson(session.day);
  const nextCourseDay =
    implementedDays.find((day) => !progress.completedDays.includes(day)) ??
    7;
  const scaffoldUseCount = Object.values(progress.scaffoldUses).reduce(
    (total, count) => total + (count ?? 0),
    0
  );
  const dayTwoAssessment = useMemo(() => {
    if (!session.dayTwoChecked || session.dayTwoAnswer.trim().length === 0) {
      return null;
    }

    return evaluateStructuredAnswer({
      skillId: "purpose",
      answer: session.dayTwoAnswer,
      selfStatement: session.dayTwoAnswer,
      evaluation: dayTwoPracticePrompt.evaluation
    });
  }, [session.dayTwoAnswer, session.dayTwoChecked]);
  const dayThreeAssessment = useMemo(() => {
    if (
      !session.dayThreeChecked ||
      session.dayThreeAnswer.trim().length === 0
    ) {
      return null;
    }

    return evaluateStructuredAnswer({
      skillId: "conclusion_first",
      answer: session.dayThreeAnswer,
      selfStatement: session.dayThreeAnswer,
      evaluation: dayThreePracticePrompt.evaluation
    });
  }, [session.dayThreeAnswer, session.dayThreeChecked]);
  const dayFourAssessment = useMemo(() => {
    if (
      !session.dayFourChecked ||
      session.dayFourAnswer.trim().length === 0
    ) {
      return null;
    }

    return evaluateDayFourAnswer(session.dayFourAnswer);
  }, [session.dayFourAnswer, session.dayFourChecked]);
  const dayFiveAssessment = useMemo(() => {
    if (
      !session.dayFiveChecked ||
      session.dayFiveAnswer.trim().length === 0
    ) {
      return null;
    }

    return evaluateStructuredAnswer({
      skillId: "grouping",
      answer: session.dayFiveAnswer,
      selfStatement: session.dayFiveAnswer,
      evaluation: dayFivePracticePrompt.evaluation
    });
  }, [session.dayFiveAnswer, session.dayFiveChecked]);
  const daySixAssessment = useMemo(() => {
    if (
      !session.daySixChecked ||
      session.daySixAnswer.trim().length === 0
    ) {
      return null;
    }

    return evaluateDaySixReport(session.daySixAnswer);
  }, [session.daySixAnswer, session.daySixChecked]);

  useEffect(() => {
    const rawSession = window.sessionStorage.getItem(PROGRESSIVE_SESSION_KEY);
    const storedProgress = parseProgressiveCourseProgress(
      window.localStorage.getItem(PROGRESSIVE_COURSE_KEY)
    );
    const storedSession = parseProgressiveCourseSession(rawSession);
    const candidate =
      rawSession === null ? createProgressiveCourseSession() : storedSession;
    const safeSession = !isProgressiveDayUnlocked(
      storedProgress,
      candidate.day
    )
      ? createProgressiveCourseSession()
      : candidate;

    setProgress(storedProgress);
    setSession(safeSession);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      PROGRESSIVE_COURSE_KEY,
      JSON.stringify(progress)
    );
  }, [hydrated, progress]);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(
      PROGRESSIVE_SESSION_KEY,
      JSON.stringify(session)
    );
  }, [hydrated, session]);

  useEffect(() => {
    if (!hydrated || session.day !== 7) return;
    window.sessionStorage.setItem(
      PROGRESSIVE_DAY_SEVEN_SESSION_KEY,
      JSON.stringify(session)
    );
  }, [hydrated, session]);

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-5xl">
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          正在恢复你的课程进度…
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <CourseHeader
        classicHref={classicHref}
        completedCount={progress.completedDays.length}
      />
      <ContinueCourseCard
        currentDay={session.day}
        day={nextCourseDay}
        onContinue={() => selectDay(nextCourseDay)}
        outcome={progress.daySevenOutcome}
      />
      <CourseMap
        currentDay={session.day}
        onSelectDay={selectDay}
        progress={progress}
      />
      <LessonProgress
        day={session.day}
        stage={session.stage}
        title={currentLesson.title}
      />

      {session.stage === "lesson" && session.day !== 7 ? (
        <LessonCard
          content={currentLesson.lesson}
          day={session.day}
          estimatedMinutes={currentLesson.estimatedMinutes}
          goal={currentLesson.conceptGoal}
          knowledgeCount={currentLesson.knowledgeChecks.length}
          onContinue={startKnowledgeCheck}
          title={currentLesson.title}
        />
      ) : null}

      {session.day === 1 && session.stage === "knowledge" ? (
        <KnowledgeCheckForm
          error={formError}
          eyebrow="Day 1 · 简单识别"
          onSelect={(questionId, optionId) => {
            setDayOneResult(null);
            setFormError(null);
            updateSession({
              dayOneSelections: {
                ...session.dayOneSelections,
                [questionId]: optionId
              }
            });
          }}
          onSubmit={submitDayOneCheck}
          questions={currentLesson.knowledgeChecks}
          result={dayOneResult}
          selections={session.dayOneSelections}
          submitLabel="检查我的选择"
        />
      ) : null}

      {session.day === 1 && session.stage === "complete" ? (
        <CompletionCard
          description="你已经能从工作任务中找到受众和期望行动。今天没有要求长文本输入。"
          eyebrow="Day 1 已完成"
          nextLabel="进入 Day 2：写一句明确目的"
          onNext={() => selectDay(2)}
          title="先确定表达的终点"
        />
      ) : null}

      {session.day === 2 && session.stage === "knowledge" ? (
        <KnowledgeCheckForm
          error={formError}
          eyebrow="Day 2 · 知识检查"
          onSelect={(_, optionId) => {
            setDayTwoKnowledgeResult(null);
            setFormError(null);
            updateSession({ dayTwoKnowledgeSelection: optionId });
          }}
          onSubmit={submitDayTwoKnowledgeCheck}
          questions={currentLesson.knowledgeChecks}
          result={dayTwoKnowledgeResult}
          selections={{
            [currentLesson.knowledgeChecks[0].id]:
              session.dayTwoKnowledgeSelection
          }}
          submitLabel="检查这句话"
        />
      ) : null}

      {session.day === 2 && session.stage === "guided" ? (
        <GuidedPurposePractice
          error={formError}
          onContinue={() => updateSession({ stage: "independent" })}
          onSelect={(value) => {
            setDayTwoGuidedResult(null);
            setFormError(null);
            updateSession({ dayTwoGuidedSelection: value });
          }}
          onSubmit={submitDayTwoGuidedPractice}
          result={dayTwoGuidedResult}
          selection={session.dayTwoGuidedSelection}
        />
      ) : null}

      {session.day === 2 && session.stage === "independent" ? (
        <IndependentPurposePractice
          answer={session.dayTwoAnswer}
          assessment={dayTwoAssessment}
          error={formError}
          onAnswerChange={(value) => {
            setFormError(null);
            updateSession({
              dayTwoAnswer: value,
              dayTwoChecked: false
            });
          }}
          onComplete={completeDayTwo}
          onShowScaffold={showDayTwoScaffold}
          onSubmit={submitDayTwoAnswer}
          scaffoldVisible={session.scaffoldVisible}
        />
      ) : null}

      {session.day === 2 && session.stage === "complete" ? (
        <CompletionCard
          description="你已经用自己的话写出包含问题和行动请求的目的句。知识选择只负责理解，本次开放回答才记录为课程内技能证据。"
          eyebrow="Day 2 已完成"
          nextLabel="进入 Day 3：把结论放到第一句"
          onNext={() => selectDay(3)}
          title="从识别进入了独立表达"
        />
      ) : null}

      {session.day === 3 && session.stage === "knowledge" ? (
        <KnowledgeCheckForm
          error={formError}
          eyebrow="Day 3 · 首句识别"
          onSelect={(_, optionId) => {
            setDayThreeKnowledgeResult(null);
            setFormError(null);
            updateSession({ dayThreeKnowledgeSelection: optionId });
          }}
          onSubmit={submitDayThreeKnowledgeCheck}
          questions={currentLesson.knowledgeChecks}
          result={dayThreeKnowledgeResult}
          selections={{
            [currentLesson.knowledgeChecks[0].id]:
              session.dayThreeKnowledgeSelection
          }}
          submitLabel="检查第一句"
        />
      ) : null}

      {session.day === 3 && session.stage === "guided" ? (
        <SentenceOrderPractice
          error={formError}
          onChange={updateDayThreeOrder}
          onContinue={() => updateSession({ stage: "independent" })}
          onSubmit={submitDayThreeOrder}
          order={session.dayThreeOrder}
          result={dayThreeOrderResult}
        />
      ) : null}

      {session.day === 3 && session.stage === "independent" ? (
        <IndependentConclusionPractice
          answer={session.dayThreeAnswer}
          assessment={dayThreeAssessment}
          error={formError}
          onAnswerChange={(value) => {
            setFormError(null);
            updateSession({
              dayThreeAnswer: value,
              dayThreeChecked: false
            });
          }}
          onComplete={completeDayThree}
          onShowScaffold={showDayThreeScaffold}
          onSubmit={submitDayThreeAnswer}
          scaffoldVisible={session.scaffoldVisible}
        />
      ) : null}

      {session.day === 3 && session.stage === "complete" ? (
        <CompletionCard
          description="你已经先给出项目判断，再补充背景和依据。排序题只帮助理解；本次无提示短答才构成结论先行的课程内证据。"
          eyebrow="Day 3 已完成"
          nextLabel="进入 Day 4：用一个理由支撑结论"
          onNext={() => selectDay(4)}
          title="让听众先听到答案"
        />
      ) : null}

      {session.day === 4 && session.stage === "knowledge" ? (
        <KnowledgeCheckForm
          error={formError}
          eyebrow="Day 4 · 理由识别"
          onSelect={(_, optionId) => {
            setDayFourKnowledgeResult(null);
            setFormError(null);
            updateSession({ dayFourKnowledgeSelection: optionId });
          }}
          onSubmit={submitDayFourKnowledgeCheck}
          questions={currentLesson.knowledgeChecks}
          result={dayFourKnowledgeResult}
          selections={{
            [currentLesson.knowledgeChecks[0].id]:
              session.dayFourKnowledgeSelection
          }}
          submitLabel="检查这条依据"
        />
      ) : null}

      {session.day === 4 && session.stage === "guided" ? (
        <GuidedSupportPractice
          error={formError}
          onContinue={() => updateSession({ stage: "independent" })}
          onSelect={(value) => {
            setDayFourGuidedResult(null);
            setFormError(null);
            updateSession({ dayFourGuidedSelection: value });
          }}
          onSubmit={submitDayFourGuidedPractice}
          result={dayFourGuidedResult}
          selection={session.dayFourGuidedSelection}
        />
      ) : null}

      {session.day === 4 && session.stage === "independent" ? (
        <IndependentSupportPractice
          answer={session.dayFourAnswer}
          assessment={dayFourAssessment}
          error={formError}
          onAnswerChange={(value) => {
            setFormError(null);
            updateSession({
              dayFourAnswer: value,
              dayFourChecked: false
            });
          }}
          onComplete={completeDayFour}
          onShowScaffold={showDayFourScaffold}
          onSubmit={submitDayFourAnswer}
          scaffoldVisible={session.scaffoldVisible}
        />
      ) : null}

      {session.day === 4 && session.stage === "complete" ? (
        <CompletionCard
          description="你已经用第一句给出判断，再用第二句提供一个直接、可核对的依据。选择题和组合练习只用于理解，独立回答才构成课程内证据。"
          eyebrow="Day 4 已完成"
          nextLabel="进入 Day 5：把信息整理成两到三点"
          onNext={() => selectDay(5)}
          title="让结论有一个站得住的理由"
        />
      ) : null}

      {session.day === 5 && session.stage === "knowledge" ? (
        <KnowledgeCheckForm
          error={formError}
          eyebrow="Day 5 · 分组识别"
          onSelect={(_, optionId) => {
            setDayFiveKnowledgeResult(null);
            setFormError(null);
            updateSession({ dayFiveKnowledgeSelection: optionId });
          }}
          onSubmit={submitDayFiveKnowledgeCheck}
          questions={currentLesson.knowledgeChecks}
          result={dayFiveKnowledgeResult}
          selections={{
            [currentLesson.knowledgeChecks[0].id]:
              session.dayFiveKnowledgeSelection
          }}
          submitLabel="检查分点方式"
        />
      ) : null}

      {session.day === 5 && session.stage === "guided" ? (
        <InformationGroupingPractice
          error={formError}
          groups={session.dayFiveCardGroups}
          onChange={updateDayFiveCardGroup}
          onContinue={() => updateSession({ stage: "independent" })}
          onSubmit={submitDayFiveGrouping}
          result={dayFiveGroupingResult}
        />
      ) : null}

      {session.day === 5 && session.stage === "independent" ? (
        <IndependentGroupingPractice
          answer={session.dayFiveAnswer}
          assessment={dayFiveAssessment}
          error={formError}
          onAnswerChange={(value) => {
            setFormError(null);
            updateSession({
              dayFiveAnswer: value,
              dayFiveChecked: false
            });
          }}
          onComplete={completeDayFive}
          onShowScaffold={showDayFiveScaffold}
          onSubmit={submitDayFiveAnswer}
          scaffoldVisible={session.scaffoldVisible}
        />
      ) : null}

      {session.day === 5 && session.stage === "complete" ? (
        <CompletionCard
          description="你已经用结论统领三个不同类别，并在未见情境中独立写出不重复的三点。信息卡归类只帮助理解，最终短答才构成课程内技能证据。"
          eyebrow="Day 5 已完成"
          nextLabel="进入 Day 6：完成一次完整工作汇报"
          onNext={() => selectDay(6)}
          title="让多个信息各就各位"
        />
      ) : null}

      {session.day === 6 && session.stage === "knowledge" ? (
        <KnowledgeCheckForm
          error={formError}
          eyebrow="Day 6 · 完整结构识别"
          onSelect={(_, optionId) => {
            setDaySixKnowledgeResult(null);
            setFormError(null);
            updateSession({ daySixKnowledgeSelection: optionId });
          }}
          onSubmit={submitDaySixKnowledgeCheck}
          questions={currentLesson.knowledgeChecks}
          result={daySixKnowledgeResult}
          selections={{
            [currentLesson.knowledgeChecks[0].id]:
              session.daySixKnowledgeSelection
          }}
          submitLabel="检查汇报顺序"
        />
      ) : null}

      {session.day === 6 && session.stage === "guided" ? (
        <GuidedReportBuilder
          error={formError}
          onChange={updateDaySixGuidedSelection}
          onContinue={() => updateSession({ stage: "independent" })}
          onSubmit={submitDaySixGuidedReport}
          result={daySixGuidedResult}
          selections={session.daySixGuidedSelections}
        />
      ) : null}

      {session.day === 6 && session.stage === "independent" ? (
        <IndependentReportPractice
          answer={session.daySixAnswer}
          assessment={daySixAssessment}
          error={formError}
          onAnswerChange={(value) => {
            setFormError(null);
            updateSession({
              daySixAnswer: value,
              daySixChecked: false
            });
          }}
          onComplete={completeDaySix}
          onShowScaffold={showDaySixScaffold}
          onSubmit={submitDaySixAnswer}
          scaffoldVisible={session.scaffoldVisible}
        />
      ) : null}

      {session.day === 6 && session.stage === "complete" ? (
        <CompletionCard
          description="你已经在一个新情境中独立组合结论、不同事实分点和明确行动请求。规则通过只说明本题结构满足要求，最终迁移仍要由 Day 7 检查。"
          eyebrow="Day 6 已完成"
          nextLabel="进入 Day 7 毕业项目"
          onNext={() => selectDay(7)}
          title="完成了一次可行动的完整汇报"
        />
      ) : null}

      {session.day === 7 ? (
        <DaySevenProject
          onCheckOriginal={checkDaySevenOriginal}
          onCheckRevision={checkDaySevenRevision}
          onCheckTransfer={checkDaySevenTransfer}
          onComplete={completeDaySeven}
          onStart={startDaySevenProject}
          onUpdate={updateDaySeven}
          onViewRevision={viewDaySevenRevision}
          onViewTransfer={() => updateSession({ stage: "project_transfer" })}
          outcome={progress.daySevenOutcome}
          scaffoldUseCount={scaffoldUseCount}
          session={session.daySeven}
          stage={session.stage}
        />
      ) : null}
    </main>
  );

  function updateSession(update: Partial<ProgressiveCourseSession>) {
    setSession((current) => ({ ...current, ...update }));
  }

  function selectDay(day: ProgressiveCourseDay) {
    if (!isProgressiveDayUnlocked(progress, day)) return;
    setFormError(null);
    setDayOneResult(null);
    setDayTwoKnowledgeResult(null);
    setDayTwoGuidedResult(null);
    setDayThreeKnowledgeResult(null);
    setDayThreeOrderResult(null);
    setDayFourKnowledgeResult(null);
    setDayFourGuidedResult(null);
    setDayFiveKnowledgeResult(null);
    setDayFiveGroupingResult(null);
    setDaySixKnowledgeResult(null);
    setDaySixGuidedResult(null);
    if (day === 7) {
      if (progress.daySevenOutcome) {
        setSession({
          ...createProgressiveCourseSession(),
          day: 7,
          stage: "complete"
        });
        return;
      }
      const storedDaySeven = parseProgressiveCourseSession(
        window.sessionStorage.getItem(PROGRESSIVE_DAY_SEVEN_SESSION_KEY)
      );
      setSession(
        storedDaySeven.day === 7
          ? storedDaySeven
          : { ...createProgressiveCourseSession(), day: 7 }
      );
      return;
    }
    setSession({ ...createProgressiveCourseSession(), day });
  }

  function startKnowledgeCheck() {
    setProgress((current) =>
      markProgressiveLessonViewed(current, session.day)
    );
    updateSession({ stage: "knowledge" });
  }

  function submitDayOneCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const unanswered = currentLesson.knowledgeChecks.some(
      (question) => !session.dayOneSelections[question.id]
    );
    if (unanswered) {
      setFormError("请先完成两道选择题，再检查答案。");
      return;
    }

    const allCorrect = currentLesson.knowledgeChecks.every(
      (question) =>
        session.dayOneSelections[question.id] === question.correctOptionId
    );
    if (!allCorrect) {
      setDayOneResult("retry");
      setFormError(null);
      return;
    }

    setDayOneResult("success");
    setFormError(null);
    setProgress((current) => completeProgressiveDay(current, 1));
    updateSession({ stage: "complete" });
  }

  function submitDayTwoKnowledgeCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = currentLesson.knowledgeChecks[0];
    if (!session.dayTwoKnowledgeSelection) {
      setFormError("请先选择一句，再检查答案。");
      return;
    }
    if (session.dayTwoKnowledgeSelection !== question.correctOptionId) {
      setDayTwoKnowledgeResult("retry");
      setFormError(null);
      return;
    }

    setDayTwoKnowledgeResult("success");
    setFormError(null);
    updateSession({ stage: "guided" });
  }

  function submitDayTwoGuidedPractice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.dayTwoGuidedSelection) {
      setFormError("请选择希望主管完成的行动。");
      return;
    }
    if (session.dayTwoGuidedSelection !== "move-meeting") {
      setDayTwoGuidedResult("retry");
      setFormError(null);
      return;
    }

    setDayTwoGuidedResult("success");
    setFormError(null);
  }

  function submitDayTwoAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const length = session.dayTwoAnswer.trim().length;
    if (length < 12) {
      setFormError("请至少写 12 个字符，把问题和希望对方做的行动说完整。");
      return;
    }

    setFormError(null);
    updateSession({ dayTwoChecked: true });
  }

  function showDayTwoScaffold() {
    if (!session.scaffoldVisible) {
      setProgress((current) =>
        recordProgressiveScaffoldUse(current, 2)
      );
    }
    updateSession({ scaffoldVisible: true });
  }

  function completeDayTwo() {
    if (dayTwoAssessment?.taskStatus !== "met") return;
    setProgress((current) => completeProgressiveDay(current, 2));
    updateSession({ stage: "complete" });
  }

  function submitDayThreeKnowledgeCheck(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const question = currentLesson.knowledgeChecks[0];
    if (!session.dayThreeKnowledgeSelection) {
      setFormError("请先选择一句作为开场。");
      return;
    }
    if (session.dayThreeKnowledgeSelection !== question.correctOptionId) {
      setDayThreeKnowledgeResult("retry");
      setFormError(null);
      return;
    }

    setDayThreeKnowledgeResult("success");
    setFormError(null);
    updateSession({ stage: "guided" });
  }

  function updateDayThreeOrder(index: number, value: string) {
    const nextOrder = [...session.dayThreeOrder];
    nextOrder[index] = value;
    setDayThreeOrderResult(null);
    setFormError(null);
    updateSession({ dayThreeOrder: nextOrder });
  }

  function submitDayThreeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.dayThreeOrder.some((item) => !item)) {
      setFormError("请为三句话都选择顺序。");
      return;
    }
    if (new Set(session.dayThreeOrder).size !== 3) {
      setFormError("每句话只能使用一次，请调整重复选项。");
      return;
    }

    const correct = dayThreeOrderExercise.correctOrder.every(
      (sentenceId, index) => session.dayThreeOrder[index] === sentenceId
    );
    setFormError(null);
    setDayThreeOrderResult(correct ? "success" : "retry");
  }

  function submitDayThreeAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const length = session.dayThreeAnswer.trim().length;
    if (length < 20) {
      setFormError("请用 2–3 句话完成，至少输入 20 个字符。");
      return;
    }

    setFormError(null);
    updateSession({ dayThreeChecked: true });
  }

  function showDayThreeScaffold() {
    if (!session.scaffoldVisible) {
      setProgress((current) =>
        recordProgressiveScaffoldUse(current, 3)
      );
    }
    updateSession({ scaffoldVisible: true });
  }

  function completeDayThree() {
    if (dayThreeAssessment?.status !== "met") return;
    setProgress((current) => completeProgressiveDay(current, 3));
    updateSession({ stage: "complete" });
  }

  function submitDayFourKnowledgeCheck(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const question = currentLesson.knowledgeChecks[0];
    if (!session.dayFourKnowledgeSelection) {
      setFormError("请先选择一条最能支撑结论的依据。");
      return;
    }
    if (session.dayFourKnowledgeSelection !== question.correctOptionId) {
      setDayFourKnowledgeResult("retry");
      setFormError(null);
      return;
    }

    setDayFourKnowledgeResult("success");
    setFormError(null);
    updateSession({ stage: "guided" });
  }

  function submitDayFourGuidedPractice(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!session.dayFourGuidedSelection) {
      setFormError("请选择一条理由补全这组表达。");
      return;
    }
    if (
      session.dayFourGuidedSelection !==
      dayFourGuidedExercise.correctReasonId
    ) {
      setDayFourGuidedResult("retry");
      setFormError(null);
      return;
    }

    setDayFourGuidedResult("success");
    setFormError(null);
  }

  function submitDayFourAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.dayFourAnswer.trim().length < 24) {
      setFormError("请用两句话完成，至少输入 24 个字符。");
      return;
    }

    setFormError(null);
    updateSession({ dayFourChecked: true });
  }

  function showDayFourScaffold() {
    if (!session.scaffoldVisible) {
      setProgress((current) =>
        recordProgressiveScaffoldUse(current, 4)
      );
    }
    updateSession({ scaffoldVisible: true });
  }

  function completeDayFour() {
    if (!dayFourAssessment?.passed) return;
    setProgress((current) => completeProgressiveDay(current, 4));
    updateSession({ stage: "complete" });
  }

  function submitDayFiveKnowledgeCheck(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const question = currentLesson.knowledgeChecks[0];
    if (!session.dayFiveKnowledgeSelection) {
      setFormError("请先选择一种分点方式。");
      return;
    }
    if (session.dayFiveKnowledgeSelection !== question.correctOptionId) {
      setDayFiveKnowledgeResult("retry");
      setFormError(null);
      return;
    }

    setDayFiveKnowledgeResult("success");
    setFormError(null);
    updateSession({ stage: "guided" });
  }

  function updateDayFiveCardGroup(cardId: string, groupId: string) {
    setDayFiveGroupingResult(null);
    setFormError(null);
    updateSession({
      dayFiveCardGroups: {
        ...session.dayFiveCardGroups,
        [cardId]: groupId
      }
    });
  }

  function submitDayFiveGrouping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const incomplete = dayFiveGroupingExercise.cards.some(
      (card) => !session.dayFiveCardGroups[card.id]
    );
    if (incomplete) {
      setFormError("请先为六张信息卡都选择一个分组。");
      return;
    }

    const correct = dayFiveGroupingExercise.cards.every(
      (card) => session.dayFiveCardGroups[card.id] === card.groupId
    );
    setFormError(null);
    setDayFiveGroupingResult(correct ? "success" : "retry");
  }

  function submitDayFiveAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.dayFiveAnswer.trim().length < 36) {
      setFormError("请先给结论，再写三个不同要点，至少输入 36 个字符。");
      return;
    }

    setFormError(null);
    updateSession({ dayFiveChecked: true });
  }

  function showDayFiveScaffold() {
    if (!session.scaffoldVisible) {
      setProgress((current) =>
        recordProgressiveScaffoldUse(current, 5)
      );
    }
    updateSession({ scaffoldVisible: true });
  }

  function completeDayFive() {
    if (dayFiveAssessment?.status !== "met") return;
    setProgress((current) => completeProgressiveDay(current, 5));
    updateSession({ stage: "complete" });
  }

  function submitDaySixKnowledgeCheck(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const question = currentLesson.knowledgeChecks[0];
    if (!session.daySixKnowledgeSelection) {
      setFormError("请先选择一种完整汇报顺序。");
      return;
    }
    if (session.daySixKnowledgeSelection !== question.correctOptionId) {
      setDaySixKnowledgeResult("retry");
      setFormError(null);
      return;
    }

    setDaySixKnowledgeResult("success");
    setFormError(null);
    updateSession({ stage: "guided" });
  }

  function updateDaySixGuidedSelection(slotId: string, blockId: string) {
    setDaySixGuidedResult(null);
    setFormError(null);
    updateSession({
      daySixGuidedSelections: {
        ...session.daySixGuidedSelections,
        [slotId]: blockId
      }
    });
  }

  function submitDaySixGuidedReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const incomplete = daySixGuidedExercise.slots.some(
      (slot) => !session.daySixGuidedSelections[slot.id]
    );
    if (incomplete) {
      setFormError("请先为四个位置都选择一句话。");
      return;
    }
    const selected = Object.values(session.daySixGuidedSelections);
    if (new Set(selected).size !== selected.length) {
      setFormError("每个句块只能使用一次，请调整重复选择。");
      return;
    }

    const correct = daySixGuidedExercise.slots.every(
      (slot) =>
        session.daySixGuidedSelections[slot.id] === slot.correctBlockId
    );
    setFormError(null);
    setDaySixGuidedResult(correct ? "success" : "retry");
  }

  function submitDaySixAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.daySixAnswer.trim().length < 56) {
      setFormError("请完成 4–6 句话，至少输入 56 个字符。");
      return;
    }

    setFormError(null);
    updateSession({ daySixChecked: true });
  }

  function showDaySixScaffold() {
    if (!session.scaffoldVisible) {
      setProgress((current) =>
        recordProgressiveScaffoldUse(current, 6)
      );
    }
    updateSession({ scaffoldVisible: true });
  }

  function completeDaySix() {
    if (!daySixAssessment?.passed) return;
    setProgress((current) => completeProgressiveDay(current, 6));
    updateSession({ stage: "complete" });
  }

  function updateDaySeven(
    update: Partial<ProgressiveCourseSession["daySeven"]>
  ) {
    setSession((current) => ({
      ...current,
      daySeven: { ...current.daySeven, ...update }
    }));
  }

  function startDaySevenProject() {
    setProgress((current) => markProgressiveLessonViewed(current, 7));
    updateSession({ stage: "project_draft" });
  }

  function checkDaySevenOriginal(passed: boolean) {
    updateDaySeven({
      originalChecked: true,
      projectInitialPassed:
        session.daySeven.projectInitialPassed ?? passed,
      projectAttempts: session.daySeven.projectAttempts + 1
    });
  }

  function viewDaySevenRevision() {
    updateSession({
      stage: "project_revision",
      daySeven: {
        ...session.daySeven,
        revisionAnswer:
          session.daySeven.revisionAnswer || session.daySeven.originalAnswer,
        revisionChecked: false
      }
    });
  }

  function checkDaySevenRevision() {
    updateDaySeven({
      revisionChecked: true,
      revisionAttempts: session.daySeven.revisionAttempts + 1
    });
  }

  function checkDaySevenTransfer(passed: boolean) {
    updateDaySeven({
      transferChecked: true,
      transferFirstPassed:
        session.daySeven.transferFirstPassed ?? passed,
      transferAttempts: session.daySeven.transferAttempts + 1
    });
  }

  function completeDaySeven(transferFinalPassed: boolean) {
    if (!session.daySeven.revisionChecked || !session.daySeven.transferChecked) {
      return;
    }
    const outcome: DaySevenOutcome = {
      ruleVersion: DAY_SEVEN_RULE_VERSION,
      projectInitialPassed:
        session.daySeven.projectInitialPassed === true,
      revisionKind:
        session.daySeven.projectInitialPassed === true
          ? "maintained"
          : "improved",
      transferFirstPassed:
        session.daySeven.transferFirstPassed === true,
      transferFinalPassed,
      revisionAttempts: session.daySeven.revisionAttempts,
      transferAttempts: session.daySeven.transferAttempts,
      completedAt: new Date().toISOString()
    };
    setProgress((current) => completeDaySevenProject(current, outcome));
    updateSession({ stage: "complete" });
  }
}

function CourseHeader({
  classicHref,
  completedCount
}: {
  classicHref: string;
  completedCount: number;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-focus">
          免费公开训练 · v0.5 预览
        </p>
        <a
          className="text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4"
          href={classicHref}
        >
          我有基础，直接做水平检查
        </a>
      </div>
      <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
        七天完成一个结构化工作汇报
      </h1>
      <p className="max-w-3xl text-base leading-7 text-slate-600">
        从看懂一个表达目的开始，逐步练到结论、理由、分点和完整项目。每天只增加一个难度，
        先学再练，不要求你一上来写长篇回答。
      </p>
      <div className="flex flex-wrap gap-2 text-sm text-slate-600">
        <span className="rounded-full bg-slate-100 px-3 py-1">
          前六天 3–7 分钟 · 毕业项目约 10 分钟
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1">
          当前完成 {completedCount} / 7 课
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1">
          浏览器本地保存 · 零模型费用
        </span>
      </div>
    </section>
  );
}

function ContinueCourseCard({
  currentDay,
  day,
  onContinue,
  outcome
}: {
  currentDay: ProgressiveCourseDay;
  day: ProgressiveCourseDay;
  onContinue(): void;
  outcome?: DaySevenOutcome;
}) {
  const activeLesson = progressiveCourse.find((lesson) => lesson.day === day);
  const isSummary = outcome !== undefined;
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
      <div>
        <p className="text-xs font-semibold text-blue-700">
          {isSummary ? "你的课程总结" : "下一步"}
        </p>
        <p className="mt-1 font-medium text-blue-950">
          {isSummary
            ? "七天流程已完成，可随时回看无原文总结"
            : `继续 Day ${day}：${activeLesson?.title ?? "继续训练"}`}
        </p>
      </div>
      <button className={primaryButtonClass} onClick={onContinue} type="button">
        {isSummary
          ? "查看七天总结"
          : currentDay === day
            ? "继续当前步骤"
            : `继续 Day ${day}`}
      </button>
    </section>
  );
}

function CourseMap({
  currentDay,
  onSelectDay,
  progress
}: {
  currentDay: ProgressiveCourseDay;
  onSelectDay(day: ProgressiveCourseDay): void;
  progress: ProgressiveCourseProgress;
}) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      id="course-map"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-focus">课程地图</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            从识别到毕业项目
          </h2>
        </div>
        <p className="text-xs text-slate-500">完成上一课后顺序解锁</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {progressiveCourse.map((lesson) => {
          const completed = progress.completedDays.includes(lesson.day);
          const prerequisiteMet = isProgressiveDayUnlocked(
            progress,
            lesson.day
          );
          const interactive =
            lesson.implemented &&
            prerequisiteMet &&
            implementedDays.includes(lesson.day);
          const active = lesson.day === currentDay;
          const status = completed
            ? "已完成"
            : !lesson.implemented
              ? "后续开发"
              : prerequisiteMet
                ? active
                  ? "学习中"
                  : "已解锁"
                : "未解锁";

          return (
            <button
              aria-label={`Day ${lesson.day} ${lesson.title} ${status}`}
              aria-pressed={active}
              className={
                active
                  ? "rounded-xl border border-focus bg-blue-50 p-4 text-left"
                  : "rounded-xl border border-slate-200 bg-slate-50 p-4 text-left disabled:cursor-not-allowed disabled:opacity-65"
              }
              disabled={!interactive}
              key={lesson.id}
              onClick={() => onSelectDay(lesson.day)}
              type="button"
            >
              <span className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                <span>Day {lesson.day} · 难度 {lesson.difficulty}</span>
                <span>{lesson.estimatedMinutes} 分钟</span>
              </span>
              <span className="mt-2 block font-semibold text-slate-950">
                {lesson.title}
              </span>
              <span className="mt-2 block text-xs text-slate-500">{status}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LessonProgress({
  day,
  stage,
  title
}: {
  day: ProgressiveCourseDay;
  stage: ProgressiveCourseSession["stage"];
  title: string;
}) {
  const stageLabels: Record<ProgressiveCourseSession["stage"], string> = {
    lesson: "知识讲解",
    knowledge: "知识检查",
    guided: "有支架练习",
    independent: "独立表达",
    project_draft: "毕业项目首稿",
    project_revision: "原稿修改",
    project_transfer: "未见迁移",
    complete: "完成"
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 px-5 py-4 text-white">
      <div>
        <p className="text-xs text-slate-300">Day {day} / 7</p>
        <p className="mt-1 font-semibold">{title}</p>
      </div>
      <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
        当前步骤：{stageLabels[stage]}
      </span>
    </section>
  );
}

function LessonCard({
  content,
  day,
  estimatedMinutes,
  goal,
  knowledgeCount,
  onContinue,
  title
}: {
  content: ProgressiveLessonContent;
  day: 1 | 2 | 3 | 4 | 5 | 6;
  estimatedMinutes: number;
  goal: string;
  knowledgeCount: number;
  onContinue(): void;
  title: string;
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-7">
      <div>
        <p className="text-sm font-medium text-focus">
          Day {day} 微课 · 预计阅读 60–90 秒
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          本课目标：{goal}。整课预计 {estimatedMinutes} 分钟。
        </p>
      </div>

      <div className="rounded-xl bg-blue-50 p-5">
        <p className="text-sm font-semibold text-blue-900">这是什么</p>
        <p className="mt-2 leading-7 text-blue-950">{content.definition}</p>
        <p className="mt-3 text-sm leading-6 text-blue-900">{content.value}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-500">一个可执行公式</p>
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 font-medium text-slate-900">
          {content.formula}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ExampleCard
          accent="red"
          explanation={content.badExample.explanation}
          label={content.badExample.label}
          text={content.badExample.text}
        />
        <ExampleCard
          accent="green"
          explanation={content.goodExample.explanation}
          label={content.goodExample.label}
          text={content.goodExample.text}
        />
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <strong>常见错误：</strong>
        {content.commonMistake}
      </p>

      {day === 6 ? (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-5">
          <p className="text-sm font-semibold text-violet-900">
            今天不是突然写一篇长文章
          </p>
          <p className="mt-2 text-sm leading-6 text-violet-900">
            你已经分别练过明确目的、结论先行、直接依据和两到三点。今天只把这些动作组合起来，并新增一个明确收尾请求。
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-violet-950 sm:grid-cols-2">
            <li>✓ Day 2：说明为什么沟通</li>
            <li>✓ Day 3：第一句给判断</li>
            <li>✓ Day 4–5：用不同事实支撑</li>
            <li>＋ Day 6：请对方明确行动</li>
          </ul>
        </section>
      ) : null}

      <button className={primaryButtonClass} onClick={onContinue} type="button">
        我理解了，做{knowledgeCount === 1 ? "一个" : "两道"}简单检查
      </button>
    </section>
  );
}

function ExampleCard({
  accent,
  explanation,
  label,
  text
}: {
  accent: "red" | "green";
  explanation: string;
  label: string;
  text: string;
}) {
  const className =
    accent === "green"
      ? "border-emerald-200 bg-emerald-50"
      : "border-red-200 bg-red-50";
  const labelClass =
    accent === "green" ? "text-emerald-800" : "text-red-800";

  return (
    <article className={`rounded-xl border p-5 ${className}`}>
      <p className={`text-sm font-semibold ${labelClass}`}>{label}</p>
      <p className="mt-2 font-medium leading-7 text-slate-950">{text}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">{explanation}</p>
    </article>
  );
}

function KnowledgeCheckForm({
  error,
  eyebrow,
  onSelect,
  onSubmit,
  questions,
  result,
  selections,
  submitLabel
}: {
  error: string | null;
  eyebrow: string;
  onSelect(questionId: string, optionId: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  questions: KnowledgeCheck[];
  result: CheckResult;
  selections: Record<string, string>;
  submitLabel: string;
}) {
  return (
    <form
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
      onSubmit={onSubmit}
    >
      <div>
        <p className="text-sm font-medium text-focus">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          先确认你是否看懂，不需要写长回答
        </h2>
      </div>

      {questions.map((question, index) => (
        <fieldset className="rounded-xl border border-slate-200 p-5" key={question.id}>
          <legend className="px-1 font-semibold text-slate-950">
            {index + 1}. {question.prompt}
          </legend>
          {question.context ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              情境：{question.context}
            </p>
          ) : null}
          <div className="mt-4 space-y-3">
            {question.options.map((option) => (
              <label
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-4 text-sm leading-6 has-[:checked]:border-focus has-[:checked]:bg-blue-50"
                key={option.id}
              >
                <input
                  checked={selections[question.id] === option.id}
                  className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                  name={question.id}
                  onChange={() => onSelect(question.id, option.id)}
                  type="radio"
                  value={option.id}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {result === "retry" ? (
            <p className="mt-3 text-sm leading-6 text-amber-800">
              {selections[question.id] === question.correctOptionId
                ? question.successExplanation
                : question.retryExplanation}
            </p>
          ) : null}
        </fieldset>
      ))}

      <FormError message={error} />
      {result === "retry" ? (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900" role="status">
          还差一点。根据提示调整选择后可以立即重试，不扣分。
        </p>
      ) : null}
      <button className={primaryButtonClass} type="submit">
        {submitLabel}
      </button>
    </form>
  );
}

function GuidedPurposePractice({
  error,
  onContinue,
  onSelect,
  onSubmit,
  result,
  selection
}: {
  error: string | null;
  onContinue(): void;
  onSelect(value: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  result: CheckResult;
  selection: string;
}) {
  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 2 · 有支架练习</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          先补全“希望对方做什么”
        </h2>
        <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
          客户演示临时改到下午三点，与团队会议冲突。你需要向主管说明。
        </div>
        <fieldset className="mt-5">
          <legend className="font-medium text-slate-900">
            希望主管听完后完成什么行动？
          </legend>
          <div className="mt-3 space-y-3">
            {[
              ["know", "了解今天所有会议的背景"],
              ["move-meeting", "今天决定把团队会议调整到四点"],
              ["praise", "认可你及时发现了冲突"]
            ].map(([value, label]) => (
              <label
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-4 text-sm has-[:checked]:border-focus has-[:checked]:bg-blue-50"
                key={value}
              >
                <input
                  checked={selection === value}
                  className="accent-blue-600"
                  name="guided-purpose"
                  onChange={() => onSelect(value)}
                  type="radio"
                  value={value}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <FormError message={error} />
        {result === "retry" ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            “了解背景”仍然不是明确行动。寻找需要主管作出的具体决定。
          </p>
        ) : null}
        <button className={`${primaryButtonClass} mt-5`} type="submit">
          组合目的句
        </button>
      </form>

      {result === "success" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
          <p className="text-sm font-medium text-emerald-800">支架组合结果</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-emerald-950">
            客户演示与团队会议时间冲突，请主管今天决定把团队会议调整到四点。
          </p>
          <p className="mt-3 text-sm leading-6 text-emerald-900">
            这一步只是帮助你看懂句子构成，不计为技能达标。下一步需要你在新情境中自己写一句。
          </p>
          <button
            className={`${primaryButtonClass} mt-5`}
            onClick={onContinue}
            type="button"
          >
            进入一句话独立练习
          </button>
        </section>
      ) : null}
    </section>
  );
}

function SentenceOrderPractice({
  error,
  onChange,
  onContinue,
  onSubmit,
  order,
  result
}: {
  error: string | null;
  onChange(index: number, value: string): void;
  onContinue(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  order: string[];
  result: CheckResult;
}) {
  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 3 · 句子排序</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          先给答案，再放依据和补充信息
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          不需要拖动。用三个下拉框安排顺序，键盘和手机都可以完成。
        </p>
        <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
          情境：{dayThreeOrderExercise.context}
        </div>
        <div className="mt-5 space-y-4">
          {[0, 1, 2].map((index) => (
            <label
              className="block rounded-xl border border-slate-200 p-4"
              htmlFor={`day-three-order-${index}`}
              key={index}
            >
              <span className="text-sm font-semibold text-slate-900">
                第 {index + 1} 句
              </span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm leading-6 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
                id={`day-three-order-${index}`}
                onChange={(event) => onChange(index, event.target.value)}
                value={order[index] ?? ""}
              >
                <option value="">请选择一句</option>
                {dayThreeOrderExercise.sentences.map((sentence) => (
                  <option key={sentence.id} value={sentence.id}>
                    {sentence.text}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <FormError message={error} />
        {result === "retry" ? (
          <p
            className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900"
            role="status"
          >
            先直接回答“是否发布”，再说明关键字段未复核，最后补充其他准备情况。
          </p>
        ) : null}
        <button className={`${primaryButtonClass} mt-5`} type="submit">
          检查句子顺序
        </button>
      </form>

      {result === "success" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
          <p className="text-sm font-medium text-emerald-800">顺序正确</p>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-emerald-950">
            {dayThreeOrderExercise.correctOrder.map((sentenceId, index) => {
              const sentence = dayThreeOrderExercise.sentences.find(
                (item) => item.id === sentenceId
              );
              return (
                <li className="flex gap-3" key={sentenceId}>
                  <span className="font-semibold">{index + 1}.</span>
                  <span>{sentence?.text}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-sm leading-6 text-emerald-900">
            排序只证明你看懂了顺序。下一步要在新情境中自己组织 2–3 句话。
          </p>
          <button
            className={`${primaryButtonClass} mt-5`}
            onClick={onContinue}
            type="button"
          >
            进入结论先行独立练习
          </button>
        </section>
      ) : null}
    </section>
  );
}

function IndependentConclusionPractice({
  answer,
  assessment,
  error,
  onAnswerChange,
  onComplete,
  onShowScaffold,
  onSubmit,
  scaffoldVisible
}: {
  answer: string;
  assessment: ReturnType<typeof evaluateStructuredAnswer> | null;
  error: string | null;
  onAnswerChange(value: string): void;
  onComplete(): void;
  onShowScaffold(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  scaffoldVisible: boolean;
}) {
  const passed = assessment?.status === "met";

  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 3 · 独立表达</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          用 2–3 句话直接回答主管
        </h2>
        <div className="mt-5 rounded-xl bg-slate-50 p-5">
          <p className="text-xs font-medium text-slate-500">
            受众：{dayThreePracticePrompt.audience}
          </p>
          <p className="mt-2 leading-7 text-slate-900">
            {dayThreePracticePrompt.prompt}
          </p>
        </div>
        {scaffoldVisible ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <p className="font-semibold">顺序支架</p>
            <p className="mt-1">
              第一句：项目判断或建议。第二句：最关键的风险或依据。需要时第三句再补背景。
            </p>
          </div>
        ) : null}
        <label
          className="mt-5 block text-sm font-medium text-slate-800"
          htmlFor="day-three-answer"
        >
          你的 2–3 句回答
        </label>
        <textarea
          className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-3 text-base leading-7 shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
          id="day-three-answer"
          maxLength={220}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="第一句先回答本周是否能按计划上线"
          value={answer}
        />
        <p className="mt-1 text-right text-xs text-slate-500">
          {answer.length} / 220
        </p>
        <FormError message={error} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={primaryButtonClass} type="submit">
            检查我的首句
          </button>
          {!scaffoldVisible ? (
            <button
              className={secondaryButtonClass}
              onClick={onShowScaffold}
              type="button"
            >
              我卡住了，查看顺序支架
            </button>
          ) : null}
        </div>
      </form>

      {assessment ? (
        <section
          aria-live="polite"
          className={
            passed
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7"
              : "rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-7"
          }
        >
          <p className="text-sm font-medium">
            {passed ? "结论先行达标" : "第一句还没有直接回答"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {assessment.statusLabel}
          </h2>
          <dl className="mt-4 space-y-3 text-sm leading-6">
            <FeedbackItem label="原文证据" value={assessment.evidence} />
            <FeedbackItem label="系统观察" value={assessment.observation} />
            <FeedbackItem label="对听众的影响" value={assessment.impact} />
            <FeedbackItem label="下一步" value={assessment.action} />
          </dl>
          {passed ? (
            <button
              className={`${primaryButtonClass} mt-5`}
              onClick={onComplete}
              type="button"
            >
              完成第 3 课
            </button>
          ) : (
            <button
              className={`${secondaryButtonClass} mt-5`}
              onClick={onShowScaffold}
              type="button"
            >
              查看顺序支架后再改一次
            </button>
          )}
        </section>
      ) : null}
    </section>
  );
}

function GuidedSupportPractice({
  error,
  onContinue,
  onSelect,
  onSubmit,
  result,
  selection
}: {
  error: string | null;
  onContinue(): void;
  onSelect(value: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  result: CheckResult;
  selection: string;
}) {
  const selectedReason = dayFourGuidedExercise.reasons.find(
    (reason) => reason.id === dayFourGuidedExercise.correctReasonId
  );

  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 4 · 有支架练习</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          给结论配一个最直接的理由
        </h2>
        <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
          情境：{dayFourGuidedExercise.context}
        </div>
        <p className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4 font-medium leading-7 text-blue-950">
          结论：{dayFourGuidedExercise.conclusion}
        </p>
        <fieldset className="mt-5">
          <legend className="font-medium text-slate-900">
            哪一个理由能最直接支撑这个结论？
          </legend>
          <div className="mt-3 space-y-3">
            {dayFourGuidedExercise.reasons.map((reason) => (
              <label
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-4 text-sm leading-6 has-[:checked]:border-focus has-[:checked]:bg-blue-50"
                key={reason.id}
              >
                <input
                  checked={selection === reason.id}
                  className="mt-1 accent-blue-600"
                  name="guided-support"
                  onChange={() => onSelect(reason.id)}
                  type="radio"
                  value={reason.id}
                />
                <span>{reason.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <FormError message={error} />
        {result === "retry" ? (
          <p
            className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900"
            role="status"
          >
            使用时间和个人偏好都不能直接证明问题。寻找包含人数、遗漏行为和旧清单缺口的事实。
          </p>
        ) : null}
        <button className={`${primaryButtonClass} mt-5`} type="submit">
          组合结论和理由
        </button>
      </form>

      {result === "success" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
          <p className="text-sm font-medium text-emerald-800">理由匹配</p>
          <p className="mt-3 text-lg font-semibold leading-8 text-emerald-950">
            {dayFourGuidedExercise.conclusion}
            {selectedReason?.text}
          </p>
          <p className="mt-3 text-sm leading-6 text-emerald-900">
            这一步帮助你识别“直接依据”，不计为技能达标。下一步需要在新情境中独立写两句话。
          </p>
          <button
            className={`${primaryButtonClass} mt-5`}
            onClick={onContinue}
            type="button"
          >
            进入两句话独立练习
          </button>
        </section>
      ) : null}
    </section>
  );
}

function IndependentSupportPractice({
  answer,
  assessment,
  error,
  onAnswerChange,
  onComplete,
  onShowScaffold,
  onSubmit,
  scaffoldVisible
}: {
  answer: string;
  assessment: ReturnType<typeof evaluateDayFourAnswer> | null;
  error: string | null;
  onAnswerChange(value: string): void;
  onComplete(): void;
  onShowScaffold(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  scaffoldVisible: boolean;
}) {
  const passed = assessment?.passed === true;

  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 4 · 独立表达</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          只写一个结论和一个关键理由
        </h2>
        <div className="mt-5 rounded-xl bg-slate-50 p-5">
          <p className="text-xs font-medium text-slate-500">
            受众：{dayFourIndependentPrompt.audience}
          </p>
          <p className="mt-2 leading-7 text-slate-900">
            {dayFourIndependentPrompt.prompt}
          </p>
        </div>
        {scaffoldVisible ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <p className="font-semibold">两句话支架</p>
            <p className="mt-1">
              第一句：建议［调整什么］。第二句：最近［一个可核对的遗漏事实］。
            </p>
            <p className="mt-2 text-xs text-blue-800">
              不要写“因为需要调整，所以要调整”；理由必须增加新的事实。
            </p>
          </div>
        ) : null}
        <label
          className="mt-5 block text-sm font-medium text-slate-800"
          htmlFor="day-four-answer"
        >
          你的两句话回答
        </label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-3 text-base leading-7 shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
          id="day-four-answer"
          maxLength={180}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="第一句给建议，第二句只写最关键的事实依据"
          value={answer}
        />
        <p className="mt-1 text-right text-xs text-slate-500">
          {answer.length} / 180
        </p>
        <FormError message={error} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={primaryButtonClass} type="submit">
            检查结论和理由
          </button>
          {!scaffoldVisible ? (
            <button
              className={secondaryButtonClass}
              onClick={onShowScaffold}
              type="button"
            >
              我卡住了，查看两句话支架
            </button>
          ) : null}
        </div>
      </form>

      {assessment ? (
        <section
          aria-live="polite"
          className={
            passed
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7"
              : "rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-7"
          }
        >
          <p className="text-sm font-medium">
            {passed ? "结论与理由达标" : "还需要调整一处"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {assessment.statusLabel}
          </h2>
          <dl className="mt-4 space-y-3 text-sm leading-6">
            <FeedbackItem label="原文证据" value={assessment.evidence} />
            <FeedbackItem label="系统观察" value={assessment.observation} />
            <FeedbackItem label="对听众的影响" value={assessment.impact} />
            <FeedbackItem label="下一步" value={assessment.action} />
          </dl>
          {passed ? (
            <button
              className={`${primaryButtonClass} mt-5`}
              onClick={onComplete}
              type="button"
            >
              完成第 4 课
            </button>
          ) : (
            <button
              className={`${secondaryButtonClass} mt-5`}
              onClick={onShowScaffold}
              type="button"
            >
              查看两句话支架后再改一次
            </button>
          )}
        </section>
      ) : null}
    </section>
  );
}

function InformationGroupingPractice({
  error,
  groups,
  onChange,
  onContinue,
  onSubmit,
  result
}: {
  error: string | null;
  groups: Record<string, string>;
  onChange(cardId: string, groupId: string): void;
  onContinue(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  result: CheckResult;
}) {
  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 5 · 信息卡归组</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          先判断每条信息属于哪一类
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          不需要拖动。为每张卡选择分组，手机和键盘都可以完成。
        </p>
        <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
          情境：{dayFiveGroupingExercise.context}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {dayFiveGroupingExercise.cards.map((card) => (
            <label
              className="block rounded-xl border border-slate-200 p-4"
              htmlFor={`day-five-card-${card.id}`}
              key={card.id}
            >
              <span className="block text-sm font-medium leading-6 text-slate-900">
                {card.text}
              </span>
              <span className="mt-3 block text-xs text-slate-500">
                所属分组
              </span>
              <select
                aria-label={`“${card.text}”所属分组`}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
                id={`day-five-card-${card.id}`}
                onChange={(event) => onChange(card.id, event.target.value)}
                value={groups[card.id] ?? ""}
              >
                <option value="">请选择分组</option>
                {dayFiveGroupingExercise.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <FormError message={error} />
        {result === "retry" ? (
          <p
            className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900"
            role="status"
          >
            还有信息放错了组。分别检查它主要描述的是用户感受、进度风险，还是团队投入。
          </p>
        ) : null}
        <button className={`${primaryButtonClass} mt-5`} type="submit">
          检查信息分组
        </button>
      </form>

      {result === "success" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
          <p className="text-sm font-medium text-emerald-800">三组信息清楚且不重复</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {dayFiveGroupingExercise.groups.map((group) => (
              <article
                className="rounded-lg bg-white/70 p-4"
                key={group.id}
              >
                <p className="font-semibold text-emerald-950">
                  {group.label}
                </p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-emerald-900">
                  {dayFiveGroupingExercise.cards
                    .filter((card) => card.groupId === group.id)
                    .map((card) => (
                      <li key={card.id}>· {card.text}</li>
                    ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-emerald-900">
            归类只证明你能识别关系，不计为技能达标。下一步要在新情境中自己组织三个要点。
          </p>
          <button
            className={`${primaryButtonClass} mt-5`}
            onClick={onContinue}
            type="button"
          >
            进入三点独立练习
          </button>
        </section>
      ) : null}
    </section>
  );
}

function IndependentGroupingPractice({
  answer,
  assessment,
  error,
  onAnswerChange,
  onComplete,
  onShowScaffold,
  onSubmit,
  scaffoldVisible
}: {
  answer: string;
  assessment: ReturnType<typeof evaluateStructuredAnswer> | null;
  error: string | null;
  onAnswerChange(value: string): void;
  onComplete(): void;
  onShowScaffold(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  scaffoldVisible: boolean;
}) {
  const passed = assessment?.status === "met";

  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 5 · 独立表达</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          先给结论，再整理成三个不同要点
        </h2>
        <div className="mt-5 rounded-xl bg-slate-50 p-5">
          <p className="text-xs font-medium text-slate-500">
            受众：{dayFivePracticePrompt.audience}
          </p>
          <p className="mt-2 leading-7 text-slate-900">
            {dayFivePracticePrompt.prompt}
          </p>
        </div>
        {scaffoldVisible ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <p className="font-semibold">三点支架</p>
            <p className="mt-1">
              建议［结论］。第一，［用户影响］；第二，［服务压力］；第三，［实施成本］。
            </p>
            <p className="mt-2 text-xs text-blue-800">
              每一点只承担一个类别，不要把同一件事换词说三次。
            </p>
          </div>
        ) : null}
        <label
          className="mt-5 block text-sm font-medium text-slate-800"
          htmlFor="day-five-answer"
        >
          你的结论和三个要点
        </label>
        <textarea
          className="mt-2 min-h-36 w-full rounded-md border border-slate-300 px-3 py-3 text-base leading-7 shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
          id="day-five-answer"
          maxLength={260}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="建议……。第一，……；第二，……；第三，……。"
          value={answer}
        />
        <p className="mt-1 text-right text-xs text-slate-500">
          {answer.length} / 260
        </p>
        <FormError message={error} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={primaryButtonClass} type="submit">
            检查三个要点
          </button>
          {!scaffoldVisible ? (
            <button
              className={secondaryButtonClass}
              onClick={onShowScaffold}
              type="button"
            >
              我卡住了，查看三点支架
            </button>
          ) : null}
        </div>
      </form>

      {assessment ? (
        <section
          aria-live="polite"
          className={
            passed
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7"
              : "rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-7"
          }
        >
          <p className="text-sm font-medium">
            {passed ? "三个要点清楚且不重复" : "分点还需要调整"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {assessment.statusLabel}
          </h2>
          <dl className="mt-4 space-y-3 text-sm leading-6">
            <FeedbackItem label="原文证据" value={assessment.evidence} />
            <FeedbackItem label="系统观察" value={assessment.observation} />
            <FeedbackItem label="对听众的影响" value={assessment.impact} />
            <FeedbackItem label="下一步" value={assessment.action} />
          </dl>
          {passed ? (
            <button
              className={`${primaryButtonClass} mt-5`}
              onClick={onComplete}
              type="button"
            >
              完成第 5 课
            </button>
          ) : (
            <button
              className={`${secondaryButtonClass} mt-5`}
              onClick={onShowScaffold}
              type="button"
            >
              查看三点支架后再改一次
            </button>
          )}
        </section>
      ) : null}
    </section>
  );
}

function GuidedReportBuilder({
  error,
  onChange,
  onContinue,
  onSubmit,
  result,
  selections
}: {
  error: string | null;
  onChange(slotId: string, blockId: string): void;
  onContinue(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  result: CheckResult;
  selections: Record<string, string>;
}) {
  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 6 · 句块组装</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          不重复手打，先把四个功能放对位置
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          每个位置选择一句，检查完整汇报是否同时包含结论、不同依据和行动请求。
        </p>
        <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
          情境：{daySixGuidedExercise.context}
        </div>
        <div className="mt-5 space-y-4">
          {daySixGuidedExercise.slots.map((slot) => (
            <label
              className="block rounded-xl border border-slate-200 p-4"
              htmlFor={`day-six-slot-${slot.id}`}
              key={slot.id}
            >
              <span className="text-sm font-semibold text-slate-900">
                {slot.label}
              </span>
              <select
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm leading-6 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
                id={`day-six-slot-${slot.id}`}
                onChange={(event) => onChange(slot.id, event.target.value)}
                value={selections[slot.id] ?? ""}
              >
                <option value="">请选择一句</option>
                {daySixGuidedExercise.blocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.text}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <FormError message={error} />
        {result === "retry" ? (
          <p
            className="mt-4 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900"
            role="status"
          >
            还有句块放错了位置。先问“我的判断是什么”，再放两个不同事实，最后确认希望主管今天做什么。
          </p>
        ) : null}
        <button className={`${primaryButtonClass} mt-5`} type="submit">
          检查完整结构
        </button>
      </form>

      {result === "success" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
          <p className="text-sm font-medium text-emerald-800">
            四个功能都在正确位置
          </p>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-emerald-950">
            {daySixGuidedExercise.slots.map((slot, index) => {
              const block = daySixGuidedExercise.blocks.find(
                (item) => item.id === slot.correctBlockId
              );
              return (
                <li className="flex gap-3" key={slot.id}>
                  <span className="font-semibold">{index + 1}.</span>
                  <span>{block?.text}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-sm leading-6 text-emerald-900">
            组装题只证明你能识别完整结构，不计为技能达标。下一步只需在一个新情境中独立写一次。
          </p>
          <button
            className={`${primaryButtonClass} mt-5`}
            onClick={onContinue}
            type="button"
          >
            进入完整汇报独立练习
          </button>
        </section>
      ) : null}
    </section>
  );
}

function IndependentReportPractice({
  answer,
  assessment,
  error,
  onAnswerChange,
  onComplete,
  onShowScaffold,
  onSubmit,
  scaffoldVisible
}: {
  answer: string;
  assessment: ReturnType<typeof evaluateDaySixReport> | null;
  error: string | null;
  onAnswerChange(value: string): void;
  onComplete(): void;
  onShowScaffold(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  scaffoldVisible: boolean;
}) {
  const passed = assessment?.passed === true;

  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 6 · 独立完整汇报</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          用 4–6 句话让负责人可以直接作决定
        </h2>
        <div className="mt-5 rounded-xl bg-slate-50 p-5">
          <p className="text-xs font-medium text-slate-500">
            受众：{daySixIndependentPrompt.audience}
          </p>
          <p className="mt-2 leading-7 text-slate-900">
            {daySixIndependentPrompt.prompt}
          </p>
        </div>
        {scaffoldVisible ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <p className="font-semibold">只给提纲，不给参考答案</p>
            <ol className="mt-2 space-y-1">
              <li>1. 第一句：建议是否延期，以及延期到哪一天。</li>
              <li>2. 中间：用“第一、第二”分别说明不同风险。</li>
              <li>3. 最后：请谁在什么时候批准什么决定。</li>
            </ol>
          </div>
        ) : null}
        <label
          className="mt-5 block text-sm font-medium text-slate-800"
          htmlFor="day-six-answer"
        >
          你的 4–6 句完整汇报
        </label>
        <textarea
          className="mt-2 min-h-44 w-full rounded-md border border-slate-300 px-3 py-3 text-base leading-7 shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
          id="day-six-answer"
          maxLength={360}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="第一句给延期判断，中间写两到三个不同事实，最后请负责人作出决定"
          value={answer}
        />
        <p className="mt-1 flex justify-between gap-3 text-xs text-slate-500">
          <span>只需输入这一次完整回答；未通过时直接在原文上修改。</span>
          <span>{answer.length} / 360</span>
        </p>
        <FormError message={error} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={primaryButtonClass} type="submit">
            检查完整汇报
          </button>
          {!scaffoldVisible ? (
            <button
              className={secondaryButtonClass}
              onClick={onShowScaffold}
              type="button"
            >
              我卡住了，查看提纲
            </button>
          ) : null}
        </div>
      </form>

      {assessment ? (
        <section
          aria-live="polite"
          className={
            passed
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7"
              : "rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-7"
          }
        >
          <p className="text-sm font-medium">
            {passed ? "完整结构达标" : "一次只改最优先的缺口"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {assessment.statusLabel}
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {assessment.checks.map((check) => (
              <li
                className="rounded-lg border border-white/80 bg-white/70 p-4 text-sm"
                key={check.id}
              >
                <p className="font-semibold text-slate-900">
                  {check.passed ? "✓" : "待补"} {check.label}
                </p>
                <p className="mt-2 leading-6 text-slate-600">
                  {check.evidence}
                </p>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-3 text-sm leading-6">
            <FeedbackItem label="系统观察" value={assessment.observation} />
            <FeedbackItem label="对负责人的影响" value={assessment.impact} />
            <FeedbackItem label="现在只改这一处" value={assessment.action} />
          </dl>
          {passed ? (
            <button
              className={`${primaryButtonClass} mt-5`}
              onClick={onComplete}
              type="button"
            >
              完成第 6 课
            </button>
          ) : (
            <button
              className={`${secondaryButtonClass} mt-5`}
              onClick={onShowScaffold}
              type="button"
            >
              查看提纲后修改原文
            </button>
          )}
        </section>
      ) : null}
    </section>
  );
}

function IndependentPurposePractice({
  answer,
  assessment,
  error,
  onAnswerChange,
  onComplete,
  onShowScaffold,
  onSubmit,
  scaffoldVisible
}: {
  answer: string;
  assessment: ReturnType<typeof evaluateStructuredAnswer> | null;
  error: string | null;
  onAnswerChange(value: string): void;
  onComplete(): void;
  onShowScaffold(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  scaffoldVisible: boolean;
}) {
  const passed = assessment?.taskStatus === "met";

  return (
    <section className="space-y-6">
      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
        onSubmit={onSubmit}
      >
        <p className="text-sm font-medium text-focus">Day 2 · 独立表达</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          现在只写一句明确目的
        </h2>
        <div className="mt-5 rounded-xl bg-slate-50 p-5">
          <p className="text-xs font-medium text-slate-500">
            受众：{dayTwoPracticePrompt.audience}
          </p>
          <p className="mt-2 leading-7 text-slate-900">
            {dayTwoPracticePrompt.prompt}
          </p>
        </div>
        {scaffoldVisible ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <p className="font-semibold">句式骨架</p>
            <p className="mt-1">
              ［当前问题］，我希望／申请［负责人完成的决定或行动］。
            </p>
          </div>
        ) : null}
        <label
          className="mt-5 block text-sm font-medium text-slate-800"
          htmlFor="day-two-answer"
        >
          用一句话写出你的明确目的
        </label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-3 text-base leading-7 shadow-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
          id="day-two-answer"
          maxLength={120}
          onChange={(event) => onAnswerChange(event.target.value)}
          placeholder="直接写问题和希望负责人采取的行动"
          value={answer}
        />
        <p className="mt-1 text-right text-xs text-slate-500">
          {answer.length} / 120
        </p>
        <FormError message={error} />
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={primaryButtonClass} type="submit">
            检查这句话
          </button>
          {!scaffoldVisible ? (
            <button
              className={secondaryButtonClass}
              onClick={onShowScaffold}
              type="button"
            >
              我卡住了，查看句式骨架
            </button>
          ) : null}
        </div>
      </form>

      {assessment ? (
        <section
          aria-live="polite"
          className={
            passed
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7"
              : "rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-7"
          }
        >
          <p className="text-sm font-medium">
            {passed ? "独立表达达标" : "还需要补一个动作"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {assessment.taskStatusLabel}
          </h2>
          <dl className="mt-4 space-y-3 text-sm leading-6">
            <FeedbackItem label="原文证据" value={assessment.evidence} />
            <FeedbackItem label="系统观察" value={assessment.observation} />
            <FeedbackItem label="下一步" value={assessment.action} />
          </dl>
          {passed ? (
            <button
              className={`${primaryButtonClass} mt-5`}
              onClick={onComplete}
              type="button"
            >
              完成第 2 课
            </button>
          ) : (
            <button
              className={`${secondaryButtonClass} mt-5`}
              onClick={onShowScaffold}
              type="button"
            >
              查看句式骨架后再改一次
            </button>
          )}
        </section>
      ) : null}
    </section>
  );
}

function CompletionCard({
  children,
  description,
  eyebrow,
  nextLabel,
  onNext,
  title
}: {
  children?: ReactNode;
  description: string;
  eyebrow: string;
  nextLabel: string;
  onNext(): void;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
      <p className="text-sm font-medium text-emerald-800">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold text-emerald-950">{title}</h2>
      <p className="mt-3 max-w-2xl leading-7 text-emerald-900">{description}</p>
      {children}
      <button
        className={`${primaryButtonClass} mt-5`}
        onClick={onNext}
        type="button"
      >
        {nextLabel}
      </button>
    </section>
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
    <p
      className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
      role="alert"
    >
      {message}
    </p>
  ) : null;
}

const primaryButtonClass =
  "inline-flex rounded-md bg-focus px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2";
const secondaryButtonClass =
  "inline-flex rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2";
