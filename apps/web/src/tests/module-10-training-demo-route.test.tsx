import { fireEvent, render, screen, within } from "@testing-library/react";

import TrainingDemoPage from "@/app/training-demo/page";
import { isProtectedRoute } from "@/server/auth/protected-routes";

const purposeDraft =
  "新用户引导改版比原计划晚三天，相关联调仍在进行。我建议把发布日期调整到下周一，请主管今天确认。";
const purposeCore = "我建议把发布日期调整到下周一，请主管今天确认。";
const purposeRevision =
  "我建议把发布日期调整到下周一，请主管今天确认。新用户引导改版比原计划晚三天，相关联调仍在进行。";
const transferAnswer =
  "关键数据还需要两天核对。我建议延后周报，请负责人今天决定。";
const transferCore = "我建议延后周报，请负责人今天决定。";

describe("Module 10 structured-practice public route", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("无需登录即可打开，初始回答为空且不会提前泄露训练方法", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("公开训练不得调用 fetch"));

    expect(isProtectedRoute("/training-demo")).toBe(false);
    render(<TrainingDemoPage />);

    expect(
      screen.getByRole("heading", { name: "五分钟结构化表达训练" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("你的无提示回答")).toHaveValue("");
    expect(screen.queryByText("明确目的")).not.toBeInTheDocument();
    expect(screen.queryByText("结论先行")).not.toBeInTheDocument();
    expect(screen.queryByText("两到三点框架")).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("短回答会显示明确错误，不会出现点击后无反应", () => {
    render(<TrainingDemoPage />);

    fireEvent.change(screen.getByLabelText("你的无提示回答"), {
      target: { value: "太短了" }
    });
    fireEvent.click(screen.getByRole("button", { name: "提交冷回答" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "请至少输入 20 个字符后再提交。"
    );
    expect(screen.getByLabelText("你的无提示回答")).toBeInTheDocument();
  });

  it("完成冷回答、单点反馈、亲自重写和迁移练习的完整闭环", () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("公开训练不得调用 fetch"));
    render(<TrainingDemoPage />);

    submitAnswer("你的无提示回答", purposeDraft, "提交冷回答");
    expect(screen.getByText("刚才的回答")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("我的核心结论"), {
      target: { value: purposeCore }
    });
    fireEvent.click(screen.getByRole("button", { name: "查看单点反馈" }));

    expect(screen.getByRole("heading", { name: "明确目的" })).toBeInTheDocument();
    const feedback = sectionForHeading("本次只改一个问题");
    expect(within(feedback).getByText("原文证据")).toBeInTheDocument();
    expect(within(feedback).getByText("只做这一个动作")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /采用/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("亲自重写"), {
      target: { value: purposeRevision }
    });
    fireEvent.click(screen.getByRole("button", { name: "检查我的重写" }));
    expect(screen.getByRole("heading", { name: "重写结果" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "进入迁移练习" }));
    submitAnswer("你的迁移回答", transferAnswer, "提交迁移回答");
    fireEvent.change(screen.getByLabelText("迁移题核心结论"), {
      target: { value: transferCore }
    });
    fireEvent.click(screen.getByRole("button", { name: "检查迁移结果" }));

    expect(
      screen.getByRole("heading", { name: "已在新情境中独立使用" })
    ).toBeInTheDocument();
    expect(screen.getByText("当前浏览器已完成 1 次训练闭环")).toBeInTheDocument();
    expect(screen.getByText("其中 1 次迁移达标")).toBeInTheDocument();
    expect(screen.queryByText(/\d+\s*%/)).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("必须实际修改原稿后才能检查重写", () => {
    render(<TrainingDemoPage />);
    submitAnswer("你的无提示回答", purposeDraft, "提交冷回答");
    fireEvent.change(screen.getByLabelText("我的核心结论"), {
      target: { value: purposeCore }
    });
    fireEvent.click(screen.getByRole("button", { name: "查看单点反馈" }));
    fireEvent.click(screen.getByRole("button", { name: "检查我的重写" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "只修改空格或标点不算有效重写"
    );
    expect(
      screen.getByRole("heading", { name: "重写结果" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "进入迁移练习" })
    ).not.toBeInTheDocument();
  });

  it("第二天能识别核心结论在后文，并提示移到开头", () => {
    render(<TrainingDemoPage />);
    fireEvent.click(screen.getByRole("button", { name: "第 2 天 职场短答" }));
    const answer =
      "目前核心功能已经完成，但还有几个联调问题。项目存在上线风险，我建议先解决联调问题再发布。";
    const core = "项目存在上线风险，我建议先解决联调问题再发布。";

    submitAnswer("你的无提示回答", answer, "提交冷回答");
    fireEvent.change(screen.getByLabelText("我的核心结论"), {
      target: { value: core }
    });
    fireEvent.click(screen.getByRole("button", { name: "查看单点反馈" }));

    expect(screen.getByRole("heading", { name: "结论先行" })).toBeInTheDocument();
    expect(
      screen.getByText("完成任务的核心判断出现在开场铺垫之后。")
    ).toBeInTheDocument();
    expect(
      screen.getByText("把这句移到开头，再将背景和依据放到后面。")
    ).toBeInTheDocument();
  });

  it("第三天能识别明确的三点结构", () => {
    render(<TrainingDemoPage />);
    fireEvent.click(screen.getByRole("button", { name: "第 3 天 职场短答" }));
    const answer =
      "我建议优先优化新用户引导，主要有三点。第一点，流失集中在前三步。第二点，相关客服咨询很多。第三点，改动成本相对较低。";

    submitAnswer("你的无提示回答", answer, "提交冷回答");
    fireEvent.change(screen.getByLabelText("我的核心结论"), {
      target: { value: "我建议优先优化新用户引导。" }
    });
    fireEvent.click(screen.getByRole("button", { name: "查看单点反馈" }));

    expect(screen.getByRole("heading", { name: "两到三点框架" })).toBeInTheDocument();
    expect(
      screen.getByText("回答明确给出 3 个部分，并覆盖了 3 个不同理由。")
    ).toBeInTheDocument();
  });

  it("已完成页面不会永久占用会话，次日到期后能够进入冷测", async () => {
    const now = Date.now();
    window.localStorage.setItem(
      "stg:v0.4:structured-practice-progress",
      JSON.stringify([
        {
          version: 2,
          id: "due-purpose",
          completedAt: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
          dueAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
          scenarioId: "stg-v04-purpose",
          coldPromptId: "stg-v04-purpose-cold-01",
          transferPromptId: "stg-v04-purpose-near-01",
          skillId: "purpose",
          sessionCompleted: true,
          skillMet: true,
          draftStatus: "partial",
          revisionStatus: "met",
          transferStatus: "met"
        }
      ])
    );
    window.sessionStorage.setItem(
      "stg:v0.4:structured-practice-session",
      JSON.stringify({
        skillId: "purpose",
        stage: "complete"
      })
    );

    render(<TrainingDemoPage />);

    expect(
      await screen.findByRole("button", { name: "开始今日冷测" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "已在新情境中独立使用" })
    ).not.toBeInTheDocument();
  });
});

function submitAnswer(label: string, value: string, buttonName: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: buttonName }));
}

function sectionForHeading(name: string) {
  const heading = screen.getByRole("heading", { name });
  const section = heading.closest("section");
  if (!section) throw new Error(`没有找到标题“${name}”所在的区域。`);
  return section;
}
