import React from "react";
import { render, screen } from "@testing-library/react";

import AdminPage from "@/app/admin/page";
import DashboardPage from "@/app/dashboard/page";
import HistoryPage from "@/app/history/page";
import ResultPage from "@/app/result/[attemptId]/page";
import WorkspacePage from "@/app/workspace/page";
import { AppShell } from "@/components/layout/AppShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe("Module 1 app shell", () => {
  it("renders the app shell with STG navigation", async () => {
    render(
      await AppShell({
        children: <main>Module shell</main>,
        user: {
          id: "user-1",
          email: "learner@example.com"
        }
      })
    );

    expect(screen.getByText("Structured Thinking Gym")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByText("Module shell")).toBeInTheDocument();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all Sprint 1 page skeletons", async () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Today Training")).toBeInTheDocument();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
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
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            result: {
              attempt: {
                status: "completed",
                originalAnswer:
                  "我想做数据分析，因为我喜欢把复杂问题讲清楚并支持业务判断。",
                submittedAt: "2026-06-19T00:00:00.000Z"
              },
              score: {
                total: 68,
                answer_relevance: 15,
                core_message: 12,
                structure: 16,
                evidence: 13,
                interview_impact: 12
              },
              diagnosis: [],
              rewrite: {
                rewrite_goal: "把核心原因提前，并保留原回答中的真实信息。",
                structure_used: "Conclusion First + Supporting Reason",
                text: "我想做数据分析，是因为我喜欢把复杂业务问题转化为可以验证的数据问题。",
                fact_preservation_note:
                  "该版本只调整表达顺序，不新增用户未提供的具体经历、数据或公司信息。"
              },
              whyBetter: [],
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
        })
      } as Response);

    render(<WorkspacePage />);
    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Conclusion First" })).toBeInTheDocument();

    render(await ResultPage({ params: Promise.resolve({ attemptId: "attempt-1" }) }));
    expect(screen.getByRole("heading", { name: "Result" })).toBeInTheDocument();
    expect(await screen.findByText("68")).toBeInTheDocument();
    expect(screen.queryByText(/attempt-1/)).not.toBeInTheDocument();

    render(<HistoryPage />);
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();

    render(<AdminPage />);
    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
  });
});
