import { fireEvent, render, screen } from "@testing-library/react";

import { RevisionPanel } from "@/components/training/RevisionPanel";
import { RescoreStatus } from "@/components/training/RescoreStatus";
import { SuggestionPanel } from "@/components/training/SuggestionPanel";
import { TrainingSessionScreen } from "@/features/training-session/TrainingSessionScreen";
import type { TrainingSessionControllerViewModel } from "@/features/training-session/TrainingSessionController";
import type {
  CompletedTrainingSessionDto,
  FeedbackReadyTrainingSessionDto,
  RescoreFailedTrainingSessionDto,
  RescoringTrainingSessionDto,
} from "@/server/training-sessions/types";

const initialAttemptId = "00000000-0000-4000-8000-000000000101";
const finalAttemptId = "00000000-0000-4000-8000-000000000102";
const decidedAt = "2026-06-25T00:03:00.000Z";
const draftText = "我希望通过数据分析帮助团队更清楚地理解业务问题。";
const suggestionText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出更清晰的判断。";
const finalText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出清晰、可靠的业务判断。";

describe("Module 10 Human-AI Revision presentation UI", () => {
  it("renders the draft, score breakdown, and suggestion without DeltaSummary", () => {
    render(<TrainingSessionScreen viewModel={viewModel()} />);

    expect(screen.getByRole("heading", { name: "训练反馈" }))
      .toBeInTheDocument();
    expect(screen.getByText("原始回答")).toBeInTheDocument();
    expect(screen.getByText(draftText)).toBeInTheDocument();
    expect(screen.getByText("评分明细")).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
    expect(screen.getByText("智能教练修改建议")).toBeInTheDocument();
    expect(screen.getByText("结论先行")).toBeInTheDocument();
    expect(screen.getByText(suggestionText)).toBeInTheDocument();
    expect(screen.queryByText(/DeltaSummary/i)).not.toBeInTheDocument();
    expect(screen.queryByText("分数变化")).not.toBeInTheDocument();
  });

  it("renders the suggestion panel with why-better evidence", () => {
    render(<SuggestionPanel suggestion={feedbackReadySession().suggestion} />);

    expect(screen.getByText("智能教练修改建议")).toBeInTheDocument();
    expect(screen.getByText("结论先行")).toBeInTheDocument();
    expect(screen.getByText(suggestionText)).toBeInTheDocument();
    expect(screen.getByText("为什么这样表达更清楚")).toBeInTheDocument();
    expect(screen.getByText("把核心观点提前到了第一句话。")).toBeInTheDocument();
  });

  it("renders Accept, Reject, and Edit controls", () => {
    render(<TrainingSessionScreen viewModel={viewModel()} />);

    expect(screen.getByRole("button", { name: "采用修改建议" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保留原稿" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "自主编辑" }))
      .toBeInTheDocument();
  });

  it("renders the Edit textarea and 6000 character limit display", () => {
    render(
      <RevisionPanel
        selectedAction="edited"
        editText="abc"
        validationError={null}
        disabled={false}
        onSelectAction={vi.fn()}
        onEditTextChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const textarea = screen.getByLabelText("编辑最终稿");
    expect(textarea).toHaveAttribute("maxLength", "6000");
    expect(screen.getByText("3 / 6000")).toBeInTheDocument();
  });

  it("displays validation errors from the controller view model", () => {
    render(
      <TrainingSessionScreen
        viewModel={viewModel({
          validationError: "edited_text must differ from the suggestion.",
          selectedAction: "edited"
        })}
      />
    );

    expect(
      screen.getByText("edited_text must differ from the suggestion.")
    ).toBeInTheDocument();
  });

  it("disables decision controls and textarea when controlsDisabled is true", () => {
    render(
      <TrainingSessionScreen
        viewModel={viewModel({
          controlsDisabled: true,
          selectedAction: "edited",
          editText: "暂时不能编辑"
        })}
      />
    );

    expect(screen.getByRole("button", { name: "采用修改建议" }))
      .toBeDisabled();
    expect(screen.getByRole("button", { name: "保留原稿" }))
      .toBeDisabled();
    expect(screen.getByRole("button", { name: "自主编辑" }))
      .toBeDisabled();
    expect(screen.getByLabelText("编辑最终稿")).toBeDisabled();
  });

  it("shows the completed final answer", () => {
    render(
      <TrainingSessionScreen
        viewModel={viewModel({ session: completedSession() })}
      />
    );

    expect(screen.getByText("重新评分已完成")).toBeInTheDocument();
    expect(screen.getByText("最终稿")).toBeInTheDocument();
    expect(screen.getByText(finalText)).toBeInTheDocument();
    expect(screen.getAllByText("初始规则得分")).toHaveLength(2);
    expect(screen.getByText("最终规则得分")).toBeInTheDocument();
    expect(screen.getByText("分数变化")).toBeInTheDocument();
    expect(screen.getByText("+14")).toBeInTheDocument();
  });

  it("shows the rescoring status", () => {
    render(<RescoreStatus session={rescoringSession()} />);

    expect(screen.getByText("正在重新评分最终稿…"))
      .toBeInTheDocument();
  });

  it("shows Retry scoring for rescore_failed sessions", () => {
    const retry = vi.fn();

    render(
      <RescoreStatus
        session={rescoreFailedSession()}
        canRetry
        disabled={false}
        onRetry={retry}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "重新评分" }));

    expect(screen.getByText("重新评分暂未完成")).toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("does not call fetch or gateway from presentation components", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("presentation must not fetch"));
    const submitRevision = vi.fn();
    const selectAction = vi.fn();
    const setEditText = vi.fn();

    render(
      <TrainingSessionScreen
        viewModel={viewModel({
          submitRevision,
          selectAction,
          setEditText
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "采用修改建议" }));
    fireEvent.click(screen.getByRole("button", { name: "提交修订" }));

    expect(selectAction).toHaveBeenCalledWith("accepted");
    expect(submitRevision).toHaveBeenCalledTimes(1);
    expect(setEditText).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

function viewModel(
  overrides: Partial<TrainingSessionControllerViewModel> = {}
): TrainingSessionControllerViewModel {
  return {
    session: feedbackReadySession(),
    isLoading: false,
    isSubmitting: false,
    validationError: null,
    networkError: null,
    retrying: false,
    editText: "",
    selectedAction: null,
    controlsDisabled: false,
    canRetry: false,
    setEditText: vi.fn(),
    selectAction: vi.fn(),
    submitRevision: vi.fn(),
    retryRevision: vi.fn(),
    refreshSession: vi.fn(),
    ...overrides
  };
}

function feedbackReadySession(): FeedbackReadyTrainingSessionDto {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    sourceMode: "demo",
    feedbackMode: "D",
    practiceDay: 1,
    promptVersion: "analysis-v1|coaching-v1",
    rubricVersion: "stg-rubric-v1",
    modelVersion: "test-model",
    status: "feedback_ready",
    draft: {
      text: draftText,
      attemptId: initialAttemptId,
      submittedAt: "2026-06-25T00:00:00.000Z"
    },
    diagnosis: [
      {
        issue_type: "late_core_message",
        severity: "medium",
        evidence: "核心观点出现在背景说明之后。",
        why_it_matters: "面试官需要尽早听到回答的核心观点。",
        fix_direction: "先说结论，再补充细节。"
      }
    ],
    suggestion: {
      text: suggestionText,
      structureUsed: "结论先行",
      whyBetter: [
        {
          changed_what: "把核心观点提前到了第一句话。",
          why_changed: "减少面试官等待关键信息的时间。",
          impact: "回答更直接，也更容易被快速理解和判断。"
        }
      ]
    },
    scoreBefore: {
      total: 68,
      dimensions: [
        {
          dimension: "core_message",
          displayName: "核心信息",
          score: 12,
          maxScore: 20,
          evidence: "核心观点出现在背景说明之后。",
          deductions: [],
          improvementFocus: "先说结论，再补充细节。"
        }
      ]
    },
    decision: null,
    final: null,
    scoreAfter: null,
    delta: null,
    feedbackShownAt: "2026-06-25T00:01:00.000Z"
  };
}

function rescoringSession(): RescoringTrainingSessionDto {
  return {
    ...feedbackReadySession(),
    status: "rescoring",
    decision: decision(),
    final: finalAnswer(),
    scoreAfter: null,
    delta: null
  };
}

function rescoreFailedSession(): RescoreFailedTrainingSessionDto {
  return {
    ...feedbackReadySession(),
    status: "rescore_failed",
    decision: decision(),
    final: finalAnswer(),
    scoreAfter: null,
    delta: null
  };
}

function completedSession(): CompletedTrainingSessionDto {
  return {
    ...feedbackReadySession(),
    status: "completed",
    decision: decision(),
    final: finalAnswer(),
    scoreAfter: {
      total: 82,
      dimensions: []
    },
    delta: null
  };
}

function decision() {
  return {
    action: "edited" as const,
    editedText: finalText,
    decidedAt,
    idempotencyKey: "revision-key"
  };
}

function finalAnswer() {
  return {
    text: finalText,
    attemptId: finalAttemptId,
    submittedAt: decidedAt
  };
}
