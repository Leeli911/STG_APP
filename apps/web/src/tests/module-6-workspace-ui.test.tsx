import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AppShell } from "@/components/layout/AppShell";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({
    push: routerPush
  })
}));

function questionResponse(liveTrainingV2Enabled = true) {
  return {
    ok: true,
    data: {
      liveTrainingV2Enabled,
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

describe("Module 6 workspace submission UI", () => {
  beforeEach(() => {
    routerPush.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows Question Pack V2 fields in Workspace", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => questionResponse()
    } as Response);

    const { default: WorkspacePage } = await import("@/app/workspace/page");
    render(<WorkspacePage />);

    expect(await screen.findByRole("heading", { name: "Conclusion First" })).toBeInTheDocument();
    expect(
      screen.getByText("面试官问你一个非常简单的问题，希望快速了解你。")
    ).toBeInTheDocument();
    expect(screen.getByText("你为什么想做数据分析这份工作？")).toBeInTheDocument();
    expect(screen.getByText("别让面试官猜答案")).toBeInTheDocument();
    expect(screen.getByText(/很多人会先讲经历/)).toBeInTheDocument();
    expect(screen.getByText("0 / 6000")).toBeInTheDocument();
  });

  it("shows the course completion state without rendering a Day7 answer form", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          question: null,
          courseCompleted: true
        },
        meta: {
          request_id: "request-complete"
        }
      })
    } as Response);

    const { default: WorkspacePage } = await import("@/app/workspace/page");
    render(<WorkspacePage />);

    expect(
      await screen.findByRole("heading", { name: "七天训练已完成" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("你的回答")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "查看训练总结" })
    ).toBeInTheDocument();
  });

  it("submits an answer and redirects to the Training Page", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => questionResponse()
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            attempt: {
              id: "attempt-1",
              questionId: "00000000-0000-4000-8000-000000000001",
              dayNumber: 1,
              answerText: "I want to do data analysis because I enjoy structure.",
              status: "submitted",
              submittedAt: "2026-06-19T00:00:00.000Z"
            }
          },
          meta: {
            request_id: "request-2"
          }
        })
      } as Response);

    const { default: WorkspacePage } = await import("@/app/workspace/page");
    render(<WorkspacePage />);

    const textarea = await screen.findByLabelText("你的回答");
    fireEvent.change(textarea, {
      target: {
        value: "I want to do data analysis because I enjoy structure."
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "提交回答" }));

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/training/attempt-1");
    });
  });

  it("uses the read-only result fallback when Live Training V2 is disabled", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => questionResponse(false)
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: { attempt: { id: "attempt-fallback" } }
        })
      } as Response);

    const { default: WorkspacePage } = await import("@/app/workspace/page");
    render(<WorkspacePage />);

    fireEvent.change(await screen.findByLabelText("你的回答"), {
      target: {
        value: "I want this role because I can turn data into clear decisions."
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "提交回答" }));

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/result/attempt-fallback");
    });
  });

  it("does not show protected navigation on unauthenticated pages", async () => {
    render(await AppShell({ children: <main>Login content</main>, user: null }));

    expect(screen.getByText("结构化思维训练场")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "训练主页" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "今日训练" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "训练记录" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });

  it("does not show Admin navigation to a normal user", async () => {
    render(
      await AppShell({
        children: <main>Dashboard content</main>,
        user: {
          id: "user-1",
          email: "learner@example.com"
        }
      })
    );

    expect(screen.getByRole("link", { name: "训练主页" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "今日训练" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "训练记录" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
  });
});
