import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush
  })
}));

function questionResponse() {
  return {
    ok: true,
    data: {
      question: {
        id: "00000000-0000-4000-8000-000000000001",
        dayNumber: 1,
        title: "Conclusion First",
        scenario: "面试官问你一个非常简单的问题，希望快速了解你。",
        prompt: "你为什么想做数据分析这份工作？",
        learningGoal: "只训练结论先行。",
        expectedStructure: "第一句话直接回答原因。后面再补充经历或背景。",
        evaluationFocus: "核心答案是否出现在第一句话。",
        knowledgeCard: {
          title: "别让面试官猜答案",
          content:
            "很多人会先讲经历，再讲原因。其实更容易的方法是先回答问题。"
        },
        isActive: true
      }
    },
    meta: {
      request_id: "request-1"
    }
  };
}

function resultResponse() {
  return {
    ok: true,
    data: {
      result: {
        attempt: {
          status: "completed",
          feedbackMode: "mock",
          originalAnswer:
            "我想做数据分析，因为我喜欢把复杂问题讲清楚并支持业务判断。"
        },
        score: {
          total: 68,
          answer_relevance: 15,
          core_message: 12,
          structure: 16,
          evidence: 13,
          interview_impact: 12
        },
        diagnosis: [
          {
            issue_type: "late_core_message",
            severity: "medium",
            evidence: "回答先解释背景，核心原因出现较晚。",
            why_it_matters:
              "面试官需要先听较长铺垫，才能知道你的主要答案。",
            fix_direction:
              "第一句话先直接说明你为什么想做数据分析，再补充经历。"
          }
        ],
        rewrite: {
          rewrite_goal: "把核心原因提前，并保留原回答中的真实信息。",
          structure_used: "Conclusion First + Supporting Reason",
          text:
            "我想做数据分析，是因为我喜欢把复杂业务问题转化为可以验证的数据问题。",
          fact_preservation_note:
            "该版本只调整表达顺序，不新增用户未提供的具体经历、数据或公司信息。"
        },
        whyBetter: [
          {
            changed_what: "把核心原因放到第一句话。",
            why_changed:
              "原回答如果先讲背景，面试官需要等待较久才能听到答案。",
            impact: "开头更直接，用户的动机更容易被理解。"
          }
        ],
        growthSuggestion: {
          focus_for_next_practice: "结论先行",
          micro_drill:
            "下一次回答时，先只写第一句话，确认它已经直接回答问题。",
          example_sentence_frame: "我想做这份工作，主要因为……",
          estimated_next_level: "Level 1"
        }
      }
    },
    meta: {
      request_id: "request-result"
    }
  };
}

describe("Module 7 UI fixes and result page", () => {
  beforeEach(() => {
    routerPush.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("shows minimum answer validation before submitting", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => questionResponse()
    } as Response);

    const { default: WorkspacePage } = await import("@/app/workspace/page");
    render(<WorkspacePage />);

    const textarea = await screen.findByLabelText("你的回答");
    fireEvent.change(textarea, {
      target: {
        value: "Too short"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "提交回答" }));

    expect(
      screen.getByText("回答内容太短。请至少写出一个完整观点和简单原因。")
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("shows recommended answer length and the 6000 character limit state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => questionResponse()
    } as Response);

    const { default: WorkspacePage } = await import("@/app/workspace/page");
    render(<WorkspacePage />);

    const textarea = await screen.findByLabelText("你的回答");

    expect(screen.getByText("建议 50-300 字")).toBeInTheDocument();

    fireEvent.change(textarea, {
      target: {
        value: "a".repeat(6000)
      }
    });

    expect(screen.getByText("6000 / 6000")).toBeInTheDocument();
    expect(screen.getByText("已达到 6000 字符上限")).toBeInTheDocument();
  });

  it("shows a development login message instead of a red auth configuration error", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STG_ENABLE_DEV_AUTH", "true");

    const { default: LoginPage } = await import("@/app/login/page");
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          error: "auth_unavailable"
        })
      })
    );

    expect(screen.getByText("Development login is enabled.")).toBeInTheDocument();
    expect(
      screen.queryByText("Authentication is not configured for this environment.")
    ).not.toBeInTheDocument();
  });

  it("renders complete mock feedback without exposing the internal attempt id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => resultResponse()
    } as Response);

    const { ResultClient } = await import("@/app/result/[attemptId]/ResultClient");
    render(<ResultClient attemptId="attempt-1" isDevelopment />);

    expect(await screen.findByRole("heading", { name: "Result" })).toBeInTheDocument();
    expect(screen.getByText("Development Mock Feedback")).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
    expect(screen.getByText("Answer Relevance")).toBeInTheDocument();
    expect(screen.getByText("回答先解释背景，核心原因出现较晚。")).toBeInTheDocument();
    expect(screen.getByText("Original Answer")).toBeInTheDocument();
    expect(screen.getByText("AI Rewrite")).toBeInTheDocument();
    expect(screen.getByText("Why Better")).toBeInTheDocument();
    expect(screen.getByText("Growth Suggestion")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回 Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.queryByText(/attempt-1/)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/attempts/attempt-1/result"
      );
    });
  });

  it("does not show the mock badge for live feedback", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => {
        const response = resultResponse();
        response.data.result.attempt.feedbackMode = "live";
        return response;
      }
    } as Response);

    const { ResultClient } = await import("@/app/result/[attemptId]/ResultClient");
    render(<ResultClient attemptId="attempt-live" isDevelopment />);

    expect(await screen.findByRole("heading", { name: "Result" })).toBeInTheDocument();
    expect(screen.queryByText("Development Mock Feedback")).not.toBeInTheDocument();
    expect(screen.getByText("AI Rewrite")).toBeInTheDocument();
  });

  it("keeps the read-only fallback usable while a background attempt is processing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          result: {
            attempt: {
              status: "analyzing",
              originalAnswer: "A complete answer that is still being analyzed.",
              submittedAt: "2026-07-20T00:00:00.000Z",
              retryAfterMs: 1500
            }
          }
        }
      })
    } as Response);

    const { ResultClient } = await import("@/app/result/[attemptId]/ResultClient");
    render(<ResultClient attemptId="attempt-processing" isDevelopment />);

    expect(
      await screen.findByRole("heading", { name: "正在生成反馈" })
    ).toBeInTheDocument();
    expect(screen.getByText(/当前状态：analyzing/)).toBeInTheDocument();
  });

  it("shows a retry entry for failed pipeline results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          result: {
            attempt: {
              status: "failed",
              originalAnswer:
                "我想做数据分析，因为我喜欢把复杂问题讲清楚并支持业务判断。",
              submittedAt: "2026-06-19T00:00:00.000Z",
              retryAvailable: true
            }
          }
        },
        meta: {
          request_id: "request-failed"
        }
      })
    } as Response);

    const { ResultClient } = await import("@/app/result/[attemptId]/ResultClient");
    render(<ResultClient attemptId="attempt-failed" isDevelopment />);

    expect(
      await screen.findByRole("heading", { name: "Feedback generation failed" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retry practice" })).toHaveAttribute(
      "href",
      "/workspace"
    );
    expect(screen.queryByText("Development Mock Feedback")).not.toBeInTheDocument();
  });
});
