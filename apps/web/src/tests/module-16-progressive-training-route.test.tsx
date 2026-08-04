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
    expect(
      screen.getByRole("button", {
        name: "Day 4 用一个理由支撑结论 未解锁"
      })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Day 5 把信息整理成两到三点 未解锁"
      })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Day 6 完成一次完整工作汇报 未解锁"
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

  it("unlocks Day 4 and requires one direct reason after the conclusion", async () => {
    unlockDayFour();
    render(<TrainingDemoPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Day 4 用一个理由支撑结论 已解锁"
      })
    );
    expect(
      screen.getByRole("heading", {
        name: "用一个理由支撑结论"
      })
    ).toBeInTheDocument();

    await startCurrentLesson("我理解了，做一个简单检查");
    fireEvent.click(
      screen.getByRole("radio", {
        name: "上周四十条咨询中，二十五条都在询问已变更的退款步骤。"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "检查这条依据" }));

    expect(
      screen.getByRole("heading", {
        name: "给结论配一个最直接的理由"
      })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("radio", {
        name: "因为最近十名新人中有六人漏交权限申请，旧清单也没有写这一步。"
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "组合结论和理由" })
    );
    expect(screen.getByText("理由匹配")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "进入两句话独立练习" })
    );

    fireEvent.change(screen.getByLabelText("你的两句话回答"), {
      target: {
        value:
          "建议更新周报提交检查清单。最近四次周报中有三次漏填新增的风险字段。"
      }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "检查结论和理由" })
    );
    expect(screen.getByText("结论与理由达标")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成第 4 课" }));

    expect(
      screen.getByRole("heading", {
        name: "让结论有一个站得住的理由"
      })
    ).toBeInTheDocument();
    const saved = JSON.parse(
      window.localStorage.getItem(PROGRESSIVE_COURSE_KEY) ?? "{}"
    );
    expect(saved.completedDays).toEqual([1, 2, 3, 4]);
  });

  it("does not complete Day 4 when the reason merely repeats the conclusion", async () => {
    unlockDayFour();
    window.sessionStorage.setItem(
      PROGRESSIVE_SESSION_KEY,
      JSON.stringify({
        version: 1,
        day: 4,
        stage: "independent",
        dayFourAnswer: "",
        dayFourChecked: false,
        scaffoldVisible: false
      })
    );
    render(<TrainingDemoPage />);

    fireEvent.change(
      await screen.findByLabelText("你的两句话回答"),
      {
        target: {
          value:
            "建议更新周报提交检查清单。因为这个检查清单现在需要更新。"
        }
      }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "检查结论和理由" })
    );

    expect(
      screen.getByRole("heading", {
        name: "理由还不能直接支撑结论"
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "完成第 4 课" })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "查看两句话支架后再改一次"
      })
    );
    expect(screen.getByText("两句话支架")).toBeInTheDocument();
  });

  it("unlocks Day 5, groups information cards, and completes an independent three-point answer", async () => {
    unlockDayFive();
    render(<TrainingDemoPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Day 5 把信息整理成两到三点 已解锁"
      })
    );
    expect(
      screen.getByRole("heading", {
        name: "把信息整理成两到三点"
      })
    ).toBeInTheDocument();

    await startCurrentLesson("我理解了，做一个简单检查");
    fireEvent.click(
      screen.getByRole("radio", {
        name: "第一，用户影响；第二，交付风险；第三，维护成本。"
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "检查分点方式" })
    );

    for (const [card, group] of [
      ["“近两周相关用户投诉增加了。”所属分组", "customer-impact"],
      [
        "“同一问题经常需要用户再次联系确认。”所属分组",
        "customer-impact"
      ],
      ["“最近三个任务中有两个发生延期。”所属分组", "delivery-risk"],
      [
        "“关键里程碑依赖人工检查，容易被遗漏。”所属分组",
        "delivery-risk"
      ],
      ["“团队每周要花数小时重复返工。”所属分组", "maintenance-cost"],
      [
        "“当前每次提交都需要两名同事手工核对。”所属分组",
        "maintenance-cost"
      ]
    ] as const) {
      fireEvent.change(screen.getByLabelText(card), {
        target: { value: group }
      });
    }
    fireEvent.click(
      screen.getByRole("button", { name: "检查信息分组" })
    );
    expect(
      screen.getByText("三组信息清楚且不重复")
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "进入三点独立练习" })
    );

    fireEvent.change(screen.getByLabelText("你的结论和三个要点"), {
      target: {
        value:
          "建议下一阶段优先优化新用户引导。第一，用户流失集中在前三步。第二，相关客服咨询很多。第三，改动成本相对较低。"
      }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "检查三个要点" })
    );
    expect(
      screen.getByText("三个要点清楚且不重复")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成第 5 课" }));

    expect(
      screen.getByRole("heading", { name: "让多个信息各就各位" })
    ).toBeInTheDocument();
    const saved = JSON.parse(
      window.localStorage.getItem(PROGRESSIVE_COURSE_KEY) ?? "{}"
    );
    expect(saved.completedDays).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not complete Day 5 when three labels repeat the same idea", async () => {
    unlockDayFive();
    window.sessionStorage.setItem(
      PROGRESSIVE_SESSION_KEY,
      JSON.stringify({
        version: 1,
        day: 5,
        stage: "independent",
        dayFiveAnswer: "",
        dayFiveChecked: false,
        scaffoldVisible: false
      })
    );
    render(<TrainingDemoPage />);

    fireEvent.change(
      await screen.findByLabelText("你的结论和三个要点"),
      {
        target: {
          value:
            "建议下一阶段优先优化新用户引导。第一，用户流失很多。第二，前三步用户流失严重。第三，流失影响转化。"
        }
      }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "检查三个要点" })
    );

    expect(screen.getByText("分点还需要调整")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "完成第 5 课" })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "查看三点支架后再改一次"
      })
    );
    expect(screen.getByText("三点支架")).toBeInTheDocument();
  });

  it("unlocks Day 6, assembles sentence blocks, and completes one independent report", async () => {
    unlockDaySix();
    render(<TrainingDemoPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Day 6 完成一次完整工作汇报 已解锁"
      })
    );
    expect(
      screen.getByRole("heading", { name: "完成一次完整工作汇报" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("今天不是突然写一篇长文章")
    ).toBeInTheDocument();

    await startCurrentLesson("我理解了，做一个简单检查");
    fireEvent.click(
      screen.getByRole("radio", {
        name: "先给结论，再分点说明依据，最后提出有时限的行动请求。"
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "检查汇报顺序" })
    );

    for (const [slot, block] of [
      ["1. 先给结论", "conclusion"],
      ["2. 第一项依据", "point-one"],
      ["3. 第二项依据", "point-two"],
      ["4. 行动请求", "request"]
    ] as const) {
      fireEvent.change(screen.getByLabelText(slot), {
        target: { value: block }
      });
    }
    fireEvent.click(
      screen.getByRole("button", { name: "检查完整结构" })
    );
    expect(
      screen.getByText("四个功能都在正确位置")
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "进入完整汇报独立练习" })
    );

    fireEvent.change(screen.getByLabelText("你的 4–6 句完整汇报"), {
      target: {
        value:
          "建议将本周五发布推迟到下周一。第一，两个关键接口仍未通过联调。第二，最近三次测试有两次出现数据同步失败。第三，客户培训已经调整到下周一。请负责人今天批准将发布推迟到下周一。"
      }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "检查完整汇报" })
    );
    expect(screen.getByText("完整结构达标")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "完整汇报结构达标" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成第 6 课" }));

    expect(
      screen.getByRole("heading", {
        name: "完成了一次可行动的完整汇报"
      })
    ).toBeInTheDocument();
    const saved = JSON.parse(
      window.localStorage.getItem(PROGRESSIVE_COURSE_KEY) ?? "{}"
    );
    expect(saved.completedDays).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("keeps Day 6 incomplete when the report has no actionable ending", async () => {
    unlockDaySix();
    window.sessionStorage.setItem(
      PROGRESSIVE_SESSION_KEY,
      JSON.stringify({
        version: 1,
        day: 6,
        stage: "independent",
        daySixAnswer: "",
        daySixChecked: false,
        scaffoldVisible: false
      })
    );
    render(<TrainingDemoPage />);

    fireEvent.change(
      await screen.findByLabelText("你的 4–6 句完整汇报"),
      {
        target: {
          value:
            "建议将本周五发布推迟到下周一。第一，两个关键接口仍未通过联调。第二，最近三次测试有两次出现数据同步失败。第三，客户培训已经调整到下周一。以上是当前情况。"
        }
      }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "检查完整汇报" })
    );

    expect(screen.getByText("一次只改最优先的缺口")).toBeInTheDocument();
    expect(
      screen.getByText("待补 最后提出有时限的行动请求")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "完成第 6 课" })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "查看提纲后修改原文" })
    );
    expect(screen.getByText("只给提纲，不给参考答案")).toBeInTheDocument();
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

function unlockDayFour() {
  window.localStorage.setItem(
    PROGRESSIVE_COURSE_KEY,
    JSON.stringify({
      version: 1,
      completedDays: [1, 2, 3],
      lessonViewedDays: [1, 2, 3],
      scaffoldUses: {},
      updatedAt: "2026-07-26T00:00:00.000Z"
    })
  );
}

function unlockDayFive() {
  window.localStorage.setItem(
    PROGRESSIVE_COURSE_KEY,
    JSON.stringify({
      version: 1,
      completedDays: [1, 2, 3, 4],
      lessonViewedDays: [1, 2, 3, 4],
      scaffoldUses: {},
      updatedAt: "2026-07-27T00:00:00.000Z"
    })
  );
}

function unlockDaySix() {
  window.localStorage.setItem(
    PROGRESSIVE_COURSE_KEY,
    JSON.stringify({
      version: 1,
      completedDays: [1, 2, 3, 4, 5],
      lessonViewedDays: [1, 2, 3, 4, 5],
      scaffoldUses: {},
      updatedAt: "2026-08-04T00:00:00.000Z"
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
