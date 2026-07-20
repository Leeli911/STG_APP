import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";

import TrainingDemoPage from "@/app/training-demo/page";
import { isProtectedRoute } from "@/server/auth/protected-routes";

const draftText =
  "团队做决策时，经常会遇到信息分散、问题难以判断的情况。我希望通过数据分析帮助团队更清楚地理解业务问题。";
const suggestionText =
  "我希望通过数据分析帮助团队更清楚地理解业务问题。团队做决策时，经常会遇到信息分散、问题难以判断的情况。";
const editedText =
  "我希望通过数据分析拆解复杂业务问题，并帮助团队做出清晰、可靠的业务判断。";

describe("Module 10 direct training demo route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders /training-demo without login and without fetch", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("training demo must not call fetch"));

    expect(isProtectedRoute("/training-demo")).toBe(false);

    render(<TrainingDemoPage />);

    expect(
      screen.getByRole("heading", { name: "训练体验题" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("你的回答")).toHaveValue(draftText);
    fireEvent.click(screen.getByRole("button", { name: "提交回答" }));

    expect(
      await screen.findByRole("heading", { name: "训练反馈" })
    ).toBeInTheDocument();
    expect(screen.getByText("原始回答")).toBeInTheDocument();
    expect(screen.getByText(draftText)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows Score Breakdown and Suggestion without DeltaSummary", async () => {
    await renderFeedback();

    expect(await screen.findByText("评分明细")).toBeInTheDocument();
    expect(screen.getByText("核心信息")).toBeInTheDocument();
    expect(screen.getByText("核心价值出现在背景说明之后。")).toBeInTheDocument();
    expect(
      screen.getByText("面试官需要先听铺垫，才能听到核心价值。")
    ).toBeInTheDocument();
    expect(screen.getByText("智能教练修改建议")).toBeInTheDocument();
    expect(screen.getByText("结论先行")).toBeInTheDocument();
    expect(screen.getByText("把第 2 句的核心价值移到了开头。")).toBeInTheDocument();
    expect(screen.getByText(suggestionText)).toBeInTheDocument();
    expect(screen.queryByText(/DeltaSummary/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Score Delta/i)).not.toBeInTheDocument();
  });

  it("accepts the suggestion and shows it as the Final Answer", async () => {
    await renderFeedback();
    await chooseAndSubmit("采用修改建议");

    const status = await completedStatusSection();
    expect(within(status).getByText("最终稿")).toBeInTheDocument();
    expect(within(status).getByText(suggestionText)).toBeInTheDocument();
  });

  it("rejects the suggestion and shows the original Draft as the Final Answer", async () => {
    await renderFeedback();
    await chooseAndSubmit("保留原稿");

    const status = await completedStatusSection();
    expect(within(status).getByText("最终稿")).toBeInTheDocument();
    expect(within(status).getByText(draftText)).toBeInTheDocument();
    expect(within(status).getByText("0")).toBeInTheDocument();
  });

  it("submits an edited answer and shows the edited Final Answer", async () => {
    await renderFeedback();

    fireEvent.click(await screen.findByRole("button", { name: "自主编辑" }));
    fireEvent.change(screen.getByLabelText("编辑最终稿"), {
      target: {
        value: editedText
      }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "提交修订" }));
    });

    const status = await completedStatusSection();
    expect(within(status).getByText("最终稿")).toBeInTheDocument();
    expect(within(status).getByText(editedText)).toBeInTheDocument();
  });

  it("lets the user practice again with a new answer after completing the loop", async () => {
    await renderFeedback();
    await chooseAndSubmit("采用修改建议");
    await completedStatusSection();

    fireEvent.click(
      screen.getByRole("button", { name: "用新回答再练一次" })
    );

    expect(
      screen.getByRole("heading", { name: "训练体验题" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("你的回答")).toHaveValue("");
  });
});

async function renderFeedback() {
  render(<TrainingDemoPage />);
  fireEvent.click(screen.getByRole("button", { name: "提交回答" }));
  expect(
    await screen.findByRole("heading", { name: "训练反馈" })
  ).toBeInTheDocument();
}

async function chooseAndSubmit(buttonName: "采用修改建议" | "保留原稿") {
  fireEvent.click(await screen.findByRole("button", { name: buttonName }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: buttonName }))
      .toHaveAttribute("aria-pressed", "true");
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "提交修订" }));
  });
}

async function completedStatusSection() {
  const complete = await screen.findByText("重新评分已完成");
  const section = complete.closest("section");
  if (!section) throw new Error("Completed status section was not rendered.");
  return section;
}
