import { randomUUID } from "node:crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/server/api/envelope";
import { getDevAuthUserFromCookieHeader } from "@/server/auth/dev-auth";
import { staticQuestionRows } from "@/server/questions/staticQuestions";
import {
  createSupabaseTrainingOverviewRepository,
  createTrainingOverviewService,
  type SupabaseTrainingOverviewClient,
  type TrainingOverview
} from "@/server/training-overview";

export async function GET(request: Request) {
  const requestId = randomUUID();
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;

  try {
    supabase = await createServerSupabaseClient();
  } catch {
    const devUser = getDevAuthUserFromCookieHeader(
      request.headers.get("cookie")
    );

    if (devUser) {
      return jsonSuccess(
        { overview: createEmptyDevelopmentOverview() },
        requestId
      );
    }

    return jsonError(
      "UNAUTHENTICATED",
      "请先登录后查看训练概览。",
      requestId,
      401
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError(
      "UNAUTHENTICATED",
      "请先登录后查看训练概览。",
      requestId,
      401
    );
  }

  try {
    const repository = createSupabaseTrainingOverviewRepository(
      supabase as unknown as SupabaseTrainingOverviewClient
    );
    const overview = await createTrainingOverviewService(
      repository
    ).getOverview(user.id);

    return jsonSuccess({ overview }, requestId);
  } catch {
    return jsonError(
      "TRAINING_OVERVIEW_FAILED",
      "训练数据暂时无法读取，请稍后重试。",
      requestId,
      500
    );
  }
}

function createEmptyDevelopmentOverview(): TrainingOverview {
  const firstQuestion = staticQuestionRows[0];

  return {
    progress: {
      currentDay: 1,
      completedDays: [],
      isComplete: false,
      totalDays: 7
    },
    todayQuestion: {
      id: firstQuestion.id,
      dayNumber: 1,
      title: firstQuestion.title,
      prompt: firstQuestion.prompt,
      learningGoal: firstQuestion.learning_goal
    },
    history: [],
    latestCompleted: null,
    weakestDimension: null
  };
}
