import { assertTrainingDayNumber } from "@/server/questions/dayNumber";
import type { TrainingDayNumber } from "@/server/questions/types";
import {
  trainingDayCount,
  type OverviewAttemptRow,
  type OverviewPracticeSessionRow,
  type OverviewScoreRow,
  type TrainingHistoryItem,
  type TrainingOverview,
  type TrainingOverviewRepository,
  type TrainingProgressSummary,
  type WeakestDimension
} from "@/server/training-overview/types";

export type TrainingOverviewService = {
  getOverview(userId: string): Promise<TrainingOverview>;
  getProgress(userId: string): Promise<TrainingProgressSummary>;
};

export function createTrainingOverviewService(
  repository: TrainingOverviewRepository
): TrainingOverviewService {
  return {
    async getProgress(userId) {
      const [sessions, attempts] = await Promise.all([
        repository.listPracticeSessions(userId),
        repository.listAttempts(userId)
      ]);

      return resolveTrainingProgress({ sessions, attempts });
    },

    async getOverview(userId) {
      const [sessions, attempts, scores, revisions, questions] =
        await Promise.all([
          repository.listPracticeSessions(userId),
          repository.listAttempts(userId),
          repository.listScores(),
          repository.listRevisions(),
          repository.listActiveQuestions()
        ]);
      const progress = resolveTrainingProgress({ sessions, attempts });
      const history = buildTrainingHistory({
        sessions,
        attempts,
        scores,
        revisions
      });
      const question = progress.isComplete
        ? null
        : questions.find((item) => item.day_number === progress.currentDay) ?? null;

      return {
        progress,
        todayQuestion: question
          ? {
              id: question.id,
              dayNumber: toTrainingDay(question.day_number),
              title: question.title,
              prompt: question.prompt,
              learningGoal: question.learning_goal
            }
          : null,
        history,
        latestCompleted:
          history.find((item) => item.status === "completed") ?? null,
        weakestDimension: findWeakestDimension(history, scores)
      };
    }
  };
}

export function resolveTrainingProgress({
  sessions
}: {
  sessions: OverviewPracticeSessionRow[];
  attempts: OverviewAttemptRow[];
}): TrainingProgressSummary {
  const completed = new Set<number>();

  for (const session of sessions) {
    if (session.status === "completed" && isTrainingDay(session.practice_day)) {
      completed.add(session.practice_day);
    }
  }

  const completedDays: TrainingDayNumber[] = [];
  for (let day = 1; day <= trainingDayCount; day += 1) {
    if (!completed.has(day)) break;
    completedDays.push(toTrainingDay(day));
  }

  const isComplete = completedDays.length === trainingDayCount;
  const currentDay = isComplete
    ? 7
    : toTrainingDay(completedDays.length + 1);

  return {
    currentDay,
    completedDays,
    isComplete,
    totalDays: trainingDayCount
  };
}

function buildTrainingHistory({
  sessions,
  attempts,
  scores,
  revisions
}: {
  sessions: OverviewPracticeSessionRow[];
  attempts: OverviewAttemptRow[];
  scores: OverviewScoreRow[];
  revisions: Awaited<
    ReturnType<TrainingOverviewRepository["listRevisions"]>
  >;
}): TrainingHistoryItem[] {
  const attemptsById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const scoresByAttemptId = new Map(scores.map((score) => [score.attempt_id, score]));
  const revisionsBySessionId = new Map(
    revisions.map((revision) => [revision.session_id, revision])
  );
  const sessionAttemptIds = new Set<string>();
  const history: TrainingHistoryItem[] = [];

  for (const session of sessions) {
    const initialAttempt = attemptsById.get(session.initial_attempt_id);
    if (!initialAttempt || !isTrainingDay(session.practice_day)) continue;

    sessionAttemptIds.add(session.initial_attempt_id);
    if (session.final_attempt_id) sessionAttemptIds.add(session.final_attempt_id);

    const finalAttempt = session.final_attempt_id
      ? attemptsById.get(session.final_attempt_id) ?? null
      : null;
    const scoreBefore = scoresByAttemptId.get(session.initial_attempt_id) ?? null;
    const scoreAfter = session.final_attempt_id
      ? scoresByAttemptId.get(session.final_attempt_id) ?? null
      : null;

    history.push({
      id: session.id,
      initialAttemptId: session.initial_attempt_id,
      finalAttemptId: session.final_attempt_id,
      practiceDay: toTrainingDay(session.practice_day),
      title: initialAttempt.question_title,
      status: session.status,
      source: "practice_session",
      createdAt: session.created_at,
      completedAt: session.completed_at,
      decision: revisionsBySessionId.get(session.id)?.action ?? null,
      originalAnswer: initialAttempt.original_answer,
      finalAnswer: finalAttempt?.original_answer ?? null,
      scoreBefore: scoreBefore?.total_score ?? null,
      scoreAfter: scoreAfter?.total_score ?? null,
      delta:
        scoreBefore && scoreAfter
          ? scoreAfter.total_score - scoreBefore.total_score
          : null,
      promptVersion: formatAttemptPromptVersion(initialAttempt),
      rubricVersion: initialAttempt.rubric_version ?? null,
      modelVersion: initialAttempt.ai_model ?? null,
      href: `/training/${session.initial_attempt_id}`
    });
  }

  for (const attempt of attempts) {
    if (sessionAttemptIds.has(attempt.id) || !isTrainingDay(attempt.day_number)) {
      continue;
    }

    const score = scoresByAttemptId.get(attempt.id) ?? null;
    history.push({
      id: attempt.id,
      initialAttemptId: attempt.id,
      finalAttemptId: null,
      practiceDay: toTrainingDay(attempt.day_number),
      title: attempt.question_title,
      status: attempt.status,
      source: "legacy_attempt",
      createdAt: attempt.created_at,
      completedAt: attempt.status === "completed" ? attempt.created_at : null,
      decision: null,
      originalAnswer: attempt.original_answer,
      finalAnswer: null,
      scoreBefore: score?.total_score ?? null,
      scoreAfter: null,
      delta: null,
      promptVersion: formatAttemptPromptVersion(attempt),
      rubricVersion: attempt.rubric_version ?? null,
      modelVersion: attempt.ai_model ?? null,
      href:
        attempt.status === "completed"
          ? `/training/${attempt.id}`
          : `/result/${attempt.id}`
    });
  }

  return history.sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)
  );
}

function formatAttemptPromptVersion(attempt: OverviewAttemptRow) {
  const versions = [
    attempt.analysis_prompt_version,
    attempt.coaching_prompt_version
  ].filter((value): value is string => Boolean(value));
  return versions.length > 0 ? versions.join("|") : null;
}

const dimensionLabels: Record<WeakestDimension["key"], string> = {
  answer_relevance: "回答相关性",
  core_message: "核心信息",
  structure: "表达结构",
  evidence: "事实证据",
  interview_impact: "面试影响力"
};

function findWeakestDimension(
  history: TrainingHistoryItem[],
  scores: OverviewScoreRow[]
): WeakestDimension | null {
  const scoresById = new Map(scores.map((score) => [score.attempt_id, score]));
  const selectedScores = history.flatMap((item) => {
    const attemptId =
      item.source === "practice_session" && item.scoreAfter !== null
        ? item.finalAttemptId ?? item.initialAttemptId
        : item.initialAttemptId;
    const score = scoresById.get(attemptId);
    return score ? [score] : [];
  });

  if (selectedScores.length === 0) return null;

  const keys = Object.keys(dimensionLabels) as WeakestDimension["key"][];
  return keys
    .map((key) => ({
      key,
      label: dimensionLabels[key],
      average:
        selectedScores.reduce((total, score) => total + score[key], 0) /
        selectedScores.length
    }))
    .sort((left, right) => left.average - right.average)[0];
}

function isTrainingDay(value: number): value is TrainingDayNumber {
  return Number.isInteger(value) && value >= 1 && value <= trainingDayCount;
}

function toTrainingDay(value: number): TrainingDayNumber {
  assertTrainingDayNumber(value);
  return value;
}
