import { fireEvent, render, screen, within } from "@testing-library/react";

import DashboardPage from "@/app/dashboard/page";
import HistoryPage from "@/app/history/page";
import {
  createTrainingOverviewService,
  resolveTrainingProgress,
  type OverviewAttemptRow,
  type OverviewPracticeSessionRow,
  type TrainingOverview,
  type TrainingOverviewRepository
} from "@/server/training-overview";

describe("Module 11 training progress", () => {
  it("does not unlock progress from an attempt without a completed revision session", () => {
    const progress = resolveTrainingProgress({
      sessions: [],
      attempts: [
        attempt({ id: "attempt-day-3", day_number: 3 }),
        attempt({ id: "attempt-day-1", day_number: 1 }),
        attempt({ id: "attempt-day-2", day_number: 2 })
      ]
    });

    expect(progress).toEqual({
      currentDay: 1,
      completedDays: [],
      isComplete: false,
      totalDays: 7
    });
  });

  it("requires a represented practice session to complete before unlocking its day", () => {
    const progress = resolveTrainingProgress({
      sessions: [session({ practice_day: 2, status: "feedback_ready" })],
      attempts: [
        attempt({ id: "day-1", day_number: 1 }),
        attempt({ id: "day-2", day_number: 2 })
      ]
    });

    expect(progress.completedDays).toEqual([]);
    expect(progress.currentDay).toBe(1);
    expect(progress.isComplete).toBe(false);
  });

  it("keeps Day 7 in an explicit completion state", () => {
    const progress = resolveTrainingProgress({
      sessions: Array.from({ length: 7 }, (_, index) =>
        session({
          id: `session-${index + 1}`,
          practice_day: index + 1,
          status: "completed"
        })
      ),
      attempts: []
    });

    expect(progress.completedDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(progress.currentDay).toBe(7);
    expect(progress.isComplete).toBe(true);
  });

  it("builds traceable history and derives score delta without persisting it", async () => {
    const repository = createRepository({
      sessions: [
        session({
          initial_attempt_id: "initial-1",
          final_attempt_id: "final-1",
          status: "completed",
          completed_at: "2026-07-20T10:05:00.000Z"
        })
      ],
      attempts: [
        attempt({ id: "initial-1", original_answer: "原稿", question_title: "Conclusion First" }),
        attempt({ id: "final-1", original_answer: "最终稿", question_title: "Conclusion First" })
      ],
      scores: [
        score({ attempt_id: "initial-1", total_score: 68, core_message: 10 }),
        score({ attempt_id: "final-1", total_score: 82, core_message: 17 })
      ],
      revisions: [
        {
          session_id: "session-1",
          action: "edited",
          created_at: "2026-07-20T10:03:00.000Z"
        }
      ]
    });

    const overview = await createTrainingOverviewService(repository).getOverview(
      "user-1"
    );

    expect(overview.history[0]).toMatchObject({
      originalAnswer: "原稿",
      finalAnswer: "最终稿",
      scoreBefore: 68,
      scoreAfter: 82,
      delta: 14,
      decision: "edited",
      href: "/training/initial-1"
    });
    expect(overview.progress.completedDays).toEqual([1]);
    expect(overview.todayQuestion?.dayNumber).toBe(2);
    expect(overview.weakestDimension?.key).toBe("answer_relevance");
  });
});

describe("Module 11 Dashboard and History UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders real progress, today's question, and recent training", async () => {
    mockOverview(overviewFixture());
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "训练概览" })).toBeInTheDocument();
    expect(await screen.findByText("七天进度")).toBeInTheDocument();
    expect(screen.getByText("当前第 2 天")).toBeInTheDocument();
    expect(screen.getByText("分类表达")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "开始今日训练" })).toHaveAttribute(
      "href",
      "/workspace"
    );
    expect(screen.getByText("+14")).toBeInTheDocument();
  });

  it("shows the persistent completion state after Day 7", async () => {
    const overview = overviewFixture();
    overview.progress = {
      currentDay: 7,
      completedDays: [1, 2, 3, 4, 5, 6, 7],
      isComplete: true,
      totalDays: 7
    };
    overview.todayQuestion = null;
    mockOverview(overview);
    render(<DashboardPage />);

    expect(await screen.findByText("回看你的修订轨迹")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "开始今日训练" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看训练记录" })).toHaveAttribute(
      "href",
      "/history"
    );
  });

  it("filters history and exposes original and final answers", async () => {
    const overview = overviewFixture();
    overview.history.push({
      ...overview.history[0],
      id: "session-failed",
      initialAttemptId: "attempt-failed",
      finalAttemptId: null,
      practiceDay: 2,
      title: "分类表达",
      status: "rescore_failed",
      finalAnswer: null,
      scoreAfter: null,
      delta: null
    });
    mockOverview(overview);
    render(<HistoryPage />);

    expect(screen.getByRole("heading", { name: "训练记录" })).toBeInTheDocument();
    const list = await screen.findByRole("region", { name: "训练历史列表" });
    expect(within(list).getByText("结论先行")).toBeInTheDocument();
    expect(within(list).getByText("分类表达")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("状态"), {
      target: { value: "failed" }
    });
    expect(screen.queryByText("结论先行")).not.toBeInTheDocument();
    expect(screen.getByText("分类表达")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("状态"), {
      target: { value: "completed" }
    });
    fireEvent.change(screen.getByLabelText("课程日"), {
      target: { value: "1" }
    });
    const details = screen.getByText("查看原稿与最终稿");
    fireEvent.click(details);
    expect(screen.getByText("我的原始回答")).toBeInTheDocument();
    expect(screen.getByText("我的最终回答")).toBeInTheDocument();
  });
});

function createRepository({
  sessions = [],
  attempts = [],
  scores = [],
  revisions = []
}: {
  sessions?: Awaited<ReturnType<TrainingOverviewRepository["listPracticeSessions"]>>;
  attempts?: Awaited<ReturnType<TrainingOverviewRepository["listAttempts"]>>;
  scores?: Awaited<ReturnType<TrainingOverviewRepository["listScores"]>>;
  revisions?: Awaited<ReturnType<TrainingOverviewRepository["listRevisions"]>>;
} = {}): TrainingOverviewRepository {
  return {
    listPracticeSessions: vi.fn().mockResolvedValue(sessions),
    listAttempts: vi.fn().mockResolvedValue(attempts),
    listScores: vi.fn().mockResolvedValue(scores),
    listRevisions: vi.fn().mockResolvedValue(revisions),
    listActiveQuestions: vi.fn().mockResolvedValue([
      {
        id: "question-1",
        day_number: 1,
        title: "结论先行",
        prompt: "第一题",
        learning_goal: "结论先行"
      },
      {
        id: "question-2",
        day_number: 2,
        title: "分类表达",
        prompt: "请用三个理由回答。",
        learning_goal: "分类表达"
      }
    ])
  };
}

function attempt(
  overrides: Partial<OverviewAttemptRow> = {}
): OverviewAttemptRow {
  return {
    id: "attempt-1",
    day_number: 1,
    original_answer: "回答",
    status: "completed",
    created_at: "2026-07-20T10:00:00.000Z",
    question_title: "结论先行",
    ...overrides
  };
}

function session(
  overrides: Partial<OverviewPracticeSessionRow> = {}
): OverviewPracticeSessionRow {
  return {
    id: "session-1",
    user_id: "user-1",
    initial_attempt_id: "attempt-1",
    final_attempt_id: null,
    practice_day: 1,
    status: "completed",
    created_at: "2026-07-20T10:00:00.000Z",
    completed_at: "2026-07-20T10:05:00.000Z",
    ...overrides
  };
}

function score(
  overrides: Partial<
    Awaited<ReturnType<TrainingOverviewRepository["listScores"]>>[number]
  > = {}
) {
  return {
    attempt_id: "attempt-1",
    answer_relevance: 12,
    core_message: 12,
    structure: 14,
    evidence: 14,
    interview_impact: 16,
    total_score: 68,
    ...overrides
  };
}

function overviewFixture(): TrainingOverview {
  const history = {
    id: "session-1",
    initialAttemptId: "attempt-1",
    finalAttemptId: "attempt-2",
    practiceDay: 1 as const,
    title: "结论先行",
    status: "completed" as const,
    source: "practice_session" as const,
    createdAt: "2026-07-20T10:00:00.000Z",
    completedAt: "2026-07-20T10:05:00.000Z",
    decision: "edited" as const,
    originalAnswer: "我的原始回答",
    finalAnswer: "我的最终回答",
    scoreBefore: 68,
    scoreAfter: 82,
    delta: 14,
    promptVersion: "analysis-v1|coaching-v1",
    rubricVersion: "stg-rubric-v1",
    modelVersion: "test-model",
    href: "/training/attempt-1"
  };

  return {
    progress: {
      currentDay: 2,
      completedDays: [1],
      isComplete: false,
      totalDays: 7
    },
    todayQuestion: {
      id: "question-2",
      dayNumber: 2,
      title: "分类表达",
      prompt: "请用三个理由回答。",
      learningGoal: "分类表达"
    },
    history: [history],
    latestCompleted: history,
    weakestDimension: {
      key: "evidence",
      label: "事实证据",
      average: 13
    }
  };
}

function mockOverview(overview: TrainingOverview) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      ok: true,
      data: { overview }
    })
  } as Response);
}
