import { fireEvent, render, screen } from "@testing-library/react";

import TrainingDemoPage from "@/app/training-demo/page";
import {
  PROGRESSIVE_COURSE_KEY,
  PROGRESSIVE_SESSION_KEY
} from "@/features/progressive-course/progress";
import { isProtectedRoute } from "@/server/auth/protected-routes";

describe("Module 16 progressive public training route", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens with a lesson and no open-answer field", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("渐进课程不得调用 fetch"));

    expect(isProtectedRoute("/training-demo")).toBe(false);
    render(<TrainingDemoPage />);

    expect(
      await screen.findByRole("heading", {
        name: "七天完成一个结构化工作汇报"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "先看懂：表达要有目的" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Day 3 把结论放到第一句 未解锁"
      })
    ).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires both Day 1 knowledge checks and unlocks Day 2", async () => {
    render(<TrainingDemoPage />);
    await startCurrentLesson("我理解了，做两道简单检查");

    fireEvent.click(screen.getByRole("button", { name: "检查我的选择" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "请先完成两道选择题"
    );

    fireEvent.click(screen.getByRole("radio", { name: "产品负责人" }));
    fireEvent.click(
      screen.getByRole("radio", {
        name: "决定是否优先优化注册流程"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "检查我的选择" }));

    expect(
      screen.getByRole("heading", { name: "先确定表达的终点" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "进入 Day 2：写一句明确目的"
      })
    ).toBeInTheDocument();

    const saved = JSON.parse(
      window.localStorage.getItem(PROGRESSIVE_COURSE_KEY) ?? "{}"
    );
    expect(saved.completedDays).toEqual([1]);
  });

  it("uses scaffolded practice before Day 2 independent writing", async () => {
    unlockDayTwo();
    render(<TrainingDemoPage />);
    await openDayTwo();

    expect(
      screen.getByRole("heading", { name: "写一句明确目的" })
    ).toBeInTheDocument();
    await startCurrentLesson("我理解了，做一个简单检查");

    fireEvent.click(
      screen.getByRole("radio", {
        name: "团队会议与客户演示时间冲突，请主管今天决定调整哪一个。"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "检查这句话" }));

    expect(
      screen.getByRole("heading", { name: "先补全“希望对方做什么”" })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("radio", {
        name: "今天决定把团队会议调整到四点"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "组合目的句" }));
    expect(
      screen.getByText(
        "客户演示与团队会议时间冲突，请主管今天决定把团队会议调整到四点。"
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "进入一句话独立练习" })
    );
    expect(
      screen.getByLabelText("用一句话写出你的明确目的")
    ).toHaveValue("");
  });

  it("only completes Day 2 after an independently written purpose sentence", async () => {
    unlockDayTwo();
    window.sessionStorage.setItem(
      PROGRESSIVE_SESSION_KEY,
      JSON.stringify({
        version: 1,
        day: 2,
        stage: "independent",
        dayOneSelections: {},
        dayTwoKnowledgeSelection: "clear-purpose",
        dayTwoGuidedSelection: "move-meeting",
        dayTwoAnswer: "",
        dayTwoChecked: false,
        scaffoldVisible: false
      })
    );
    render(<TrainingDemoPage />);

    const answer = await screen.findByLabelText("用一句话写出你的明确目的");
    fireEvent.change(answer, {
      target: {
        value:
          "本期预算已经使用九成，我申请项目负责人批准缩小本期范围，暂缓两个非核心需求。"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "检查这句话" }));

    expect(
      screen.getByRole("heading", { name: "任务信息完整" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成第 2 课" }));

    expect(
      screen.getByRole("heading", { name: "从识别进入了独立表达" })
    ).toBeInTheDocument();
    const saved = JSON.parse(
      window.localStorage.getItem(PROGRESSIVE_COURSE_KEY) ?? "{}"
    );
    expect(saved.completedDays).toEqual([1, 2]);
  });

  it("restores the current lesson step and answer after refresh", async () => {
    unlockDayTwo();
    window.sessionStorage.setItem(
      PROGRESSIVE_SESSION_KEY,
      JSON.stringify({
        version: 1,
        day: 2,
        stage: "independent",
        dayOneSelections: {},
        dayTwoKnowledgeSelection: "clear-purpose",
        dayTwoGuidedSelection: "move-meeting",
        dayTwoAnswer: "本期预算已使用九成，请负责人批准缩小本期范围。",
        dayTwoChecked: false,
        scaffoldVisible: true
      })
    );

    const { unmount } = render(<TrainingDemoPage />);
    expect(
      await screen.findByLabelText("用一句话写出你的明确目的")
    ).toHaveValue("本期预算已使用九成，请负责人批准缩小本期范围。");
    expect(screen.getByText("句式骨架")).toBeInTheDocument();
    unmount();

    render(<TrainingDemoPage />);
    expect(
      await screen.findByLabelText("用一句话写出你的明确目的")
    ).toHaveValue("本期预算已使用九成，请负责人批准缩小本期范围。");
  });

  it("unlocks Day 3 and requires sentence order before independent conclusion-first writing", async () => {
    unlockDayThree();
    render(<TrainingDemoPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Day 3 把结论放到第一句 已解锁"
      })
    );
    expect(
      screen.getByRole("heading", { name: "把结论放到第一句" })
    ).toBeInTheDocument();

    await startCurrentLesson("我理解了，做一个简单检查");
    fireEvent.click(
      screen.getByRole("radio", {
        name: "建议先调整权限配置培训，因为这是新人最集中的卡点。"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "检查第一句" }));

    fireEvent.change(screen.getByLabelText("第 1 句"), {
      target: { value: "conclusion" }
    });
    fireEvent.change(screen.getByLabelText("第 2 句"), {
      target: { value: "reason" }
    });
    fireEvent.change(screen.getByLabelText("第 3 句"), {
      target: { value: "detail" }
    });
    fireEvent.click(screen.getByRole("button", { name: "检查句子顺序" }));
    expect(screen.getByText("顺序正确")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "进入结论先行独立练习" })
    );

    fireEvent.change(screen.getByLabelText("你的 2–3 句回答"), {
      target: {
        value:
          "项目存在周五上线风险，我建议先解决联调问题再发布。目前核心功能已经完成，但联调问题可能影响周五计划。"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "检查我的首句" }));
    expect(screen.getByText("结论先行达标")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成第 3 课" }));

    expect(
      screen.getByRole("heading", { name: "让听众先听到答案" })
    ).toBeInTheDocument();
    const saved = JSON.parse(
      window.localStorage.getItem(PROGRESSIVE_COURSE_KEY) ?? "{}"
    );
    expect(saved.completedDays).toEqual([1, 2, 3]);
  });

  it("shows a targeted scaffold when Day 3 starts with background", async () => {
    unlockDayThree();
    window.sessionStorage.setItem(
      PROGRESSIVE_SESSION_KEY,
      JSON.stringify({
        version: 1,
        day: 3,
        stage: "independent",
        dayOneSelections: {},
        dayTwoKnowledgeSelection: "",
        dayTwoGuidedSelection: "",
        dayTwoAnswer: "",
        dayTwoChecked: false,
        dayThreeKnowledgeSelection: "conclusion-first",
        dayThreeOrder: ["conclusion", "reason", "detail"],
        dayThreeAnswer: "",
        dayThreeChecked: false,
        scaffoldVisible: false
      })
    );
    render(<TrainingDemoPage />);

    fireEvent.change(
      await screen.findByLabelText("你的 2–3 句回答"),
      {
        target: {
          value:
            "目前核心功能已经完成，但还有几个联调问题。项目存在上线风险，我建议先解决联调问题再发布。"
        }
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "检查我的首句" }));

    expect(screen.getByText("第一句还没有直接回答")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "查看顺序支架后再改一次" })
    );
    expect(screen.getByText("顺序支架")).toBeInTheDocument();
  });
});

async function startCurrentLesson(buttonName: string) {
  fireEvent.click(
    await screen.findByRole("button", {
      name: buttonName
    })
  );
}

function unlockDayTwo() {
  window.localStorage.setItem(
    PROGRESSIVE_COURSE_KEY,
    JSON.stringify({
      version: 1,
      completedDays: [1],
      lessonViewedDays: [1],
      scaffoldUses: {},
      updatedAt: "2026-07-26T00:00:00.000Z"
    })
  );
}

function unlockDayThree() {
  window.localStorage.setItem(
    PROGRESSIVE_COURSE_KEY,
    JSON.stringify({
      version: 1,
      completedDays: [1, 2],
      lessonViewedDays: [1, 2],
      scaffoldUses: {},
      updatedAt: "2026-07-26T00:00:00.000Z"
    })
  );
}

async function openDayTwo() {
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Day 2 写一句明确目的 已解锁"
    })
  );
}
