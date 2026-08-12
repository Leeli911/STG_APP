import { expect, test } from "@playwright/test";

test("新用户从知识讲解开始，并完成 Day 1 到 Day 2 的渐进训练", async ({
  page,
  baseURL
}) => {
  const forbiddenRequests: string[] = [];
  const appOrigin = new URL(baseURL!).origin;

  page.on("request", (request) => {
    const url = new URL(request.url());
    const isApiTransport = ["fetch", "xhr"].includes(request.resourceType());
    const isAppApi = url.origin === appOrigin && url.pathname.startsWith("/api/");
    const isExternalApi = url.origin !== appOrigin && isApiTransport;
    const isKnownModelOrDatabase =
      /(?:openai\.com|supabase\.(?:co|in))$/i.test(url.hostname);

    if (isAppApi || isExternalApi || isKnownModelOrDatabase) {
      forbiddenRequests.push(request.url());
    }
  });

  await page.goto("/");
  await page.getByRole("link", { name: "从第一课开始" }).click();

  await expect(page).toHaveURL(/\/training-demo$/);
  await expect(
    page.getByRole("heading", { name: "七天完成一个结构化工作汇报" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "先看懂：表达要有目的" })
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  await page
    .getByRole("button", { name: "我理解了，做两道简单检查" })
    .click();
  await page.getByRole("radio", { name: "产品负责人" }).check();
  await page
    .getByRole("radio", { name: "决定是否优先优化注册流程" })
    .check();
  await page.getByRole("button", { name: "检查我的选择" }).click();

  await expect(
    page.getByRole("heading", { name: "先确定表达的终点" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "进入第 2 天：写一句明确目的" })
    .click();

  await expect(
    page.getByRole("heading", { name: "写一句明确目的" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "团队会议与客户演示时间冲突，请主管今天决定调整哪一个。"
    })
    .check();
  await page.getByRole("button", { name: "检查这句话" }).click();
  await page
    .getByRole("radio", { name: "今天决定把团队会议调整到四点" })
    .check();
  await page.getByRole("button", { name: "组合目的句" }).click();
  await page
    .getByRole("button", { name: "进入一句话独立练习" })
    .click();

  await page
    .getByLabel("用一句话写出你的明确目的")
    .fill(
      "本期预算已经使用九成，我申请项目负责人批准缩小本期范围，暂缓两个非核心需求。"
    );
  await page.getByRole("button", { name: "检查这句话" }).click();
  await expect(page.getByText("独立表达达标")).toBeVisible();
  await page.getByRole("button", { name: "完成第 2 课" }).click();

  await expect(
    page.getByRole("heading", { name: "从识别进入了独立表达" })
  ).toBeVisible();
  await expect(page.getByText("当前进度 2 / 7 课")).toBeVisible();
  expect(forbiddenRequests).toEqual([]);
});

test("课程锁定后续难度，并在刷新后恢复 Day 2 回答和支架", async ({
  page
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "stg:v0.5:progressive-course",
      JSON.stringify({
        version: 1,
        completedDays: [1],
        lessonViewedDays: [1, 2],
        scaffoldUses: { 2: 1 },
        updatedAt: new Date().toISOString()
      })
    );
    window.sessionStorage.setItem(
      "stg:v0.5:progressive-session",
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
  });

  await page.goto("/training-demo");
  const answer = page.getByLabel("用一句话写出你的明确目的");
  await expect(answer).toHaveValue(
    "本期预算已使用九成，请负责人批准缩小本期范围。"
  );
  await expect(page.getByText("句式骨架")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "第 3 天 把结论放到第一句 未解锁"
    })
  ).toBeDisabled();

  await page.reload();
  await expect(page.getByLabel("用一句话写出你的明确目的")).toHaveValue(
    "本期预算已使用九成，请负责人批准缩小本期范围。"
  );
  await expect(page.getByText("句式骨架")).toBeVisible();
  await page.getByRole("button", { name: "继续当前步骤" }).click();
  await expect(page.getByLabel("用一句话写出你的明确目的")).toHaveValue(
    "本期预算已使用九成，请负责人批准缩小本期范围。"
  );
  await expect(page.locator("#current-lesson")).toBeFocused();
});

test("Day 3 从首句识别和排序进入无提示结论先行表达", async ({
  page
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "stg:v0.5:progressive-course",
      JSON.stringify({
        version: 1,
        completedDays: [1, 2],
        lessonViewedDays: [1, 2],
        scaffoldUses: {},
        updatedAt: new Date().toISOString()
      })
    );
  });

  await page.goto("/training-demo");
  await page
    .getByRole("button", {
      name: "第 3 天 把结论放到第一句 已解锁"
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "把结论放到第一句" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "建议先调整权限配置培训，因为这是新人最集中的卡点。"
    })
    .check();
  await page.getByRole("button", { name: "检查第一句" }).click();

  await page.getByLabel("第 1 句").selectOption("conclusion");
  await page.getByLabel("第 2 句").selectOption("reason");
  await page.getByLabel("第 3 句").selectOption("detail");
  await page.getByRole("button", { name: "检查句子顺序" }).click();
  await expect(page.getByText("顺序正确")).toBeVisible();
  await page
    .getByRole("button", { name: "进入结论先行独立练习" })
    .click();

  await page
    .getByLabel("你的 2–3 句回答")
    .fill(
      "项目存在周五上线风险，我建议先解决联调问题再发布。目前核心功能已经完成，但联调问题可能影响周五计划。"
    );
  await page.getByRole("button", { name: "检查我的首句" }).click();
  await expect(page.getByText("结论先行达标")).toBeVisible();
  await page.getByRole("button", { name: "完成第 3 课" }).click();

  await expect(
    page.getByRole("heading", { name: "让听众先听到答案" })
  ).toBeVisible();
  await expect(page.getByText("当前进度 3 / 7 课")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "第 4 天 用一个理由支撑结论 已解锁"
    })
  ).toBeEnabled();
});

test("Day 4 从理由识别进入两句话独立表达，并拒绝循环理由", async ({
  page
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "stg:v0.5:progressive-course",
      JSON.stringify({
        version: 1,
        completedDays: [1, 2, 3],
        lessonViewedDays: [1, 2, 3],
        scaffoldUses: {},
        updatedAt: new Date().toISOString()
      })
    );
  });

  await page.goto("/training-demo");
  await page
    .getByRole("button", {
      name: "第 4 天 用一个理由支撑结论 已解锁"
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "用一个理由支撑结论" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "上周四十条咨询中，二十五条都在询问已变更的退款步骤。"
    })
    .check();
  await page.getByRole("button", { name: "检查这条依据" }).click();

  await page
    .getByRole("radio", {
      name: "因为最近十名新人中有六人漏交权限申请，旧清单也没有写这一步。"
    })
    .check();
  await page.getByRole("button", { name: "组合结论和理由" }).click();
  await expect(page.getByText("理由匹配")).toBeVisible();
  await page
    .getByRole("button", { name: "进入两句话独立练习" })
    .click();

  const answer = page.getByLabel("你的两句话回答");
  await answer.fill(
    "建议更新周报提交检查清单。因为这个检查清单现在需要更新。"
  );
  await page.getByRole("button", { name: "检查结论和理由" }).click();
  await expect(
    page.getByRole("heading", { name: "理由还不能直接支撑结论" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "完成第 4 课" })
  ).toHaveCount(0);

  await answer.fill(
    "建议更新周报提交检查清单。最近四次周报中有三次漏填新增的风险字段。"
  );
  await page.getByRole("button", { name: "检查结论和理由" }).click();
  await expect(page.getByText("结论与理由达标")).toBeVisible();
  await page.getByRole("button", { name: "完成第 4 课" }).click();

  await expect(
    page.getByRole("heading", { name: "让结论有一个站得住的理由" })
  ).toBeVisible();
  await expect(page.getByText("当前进度 4 / 7 课")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "第 5 天 把信息整理成两到三点 已解锁"
    })
  ).toBeEnabled();
});

test("Day 5 在移动端完成信息归组，并只接受互不重复的三个要点", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "stg:v0.5:progressive-course",
      JSON.stringify({
        version: 1,
        completedDays: [1, 2, 3, 4],
        lessonViewedDays: [1, 2, 3, 4],
        scaffoldUses: {},
        updatedAt: new Date().toISOString()
      })
    );
  });

  await page.goto("/training-demo");
  await page
    .getByRole("button", {
      name: "第 5 天 把信息整理成两到三点 已解锁"
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "把信息整理成两到三点" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "第一，用户影响；第二，交付风险；第三，维护成本。"
    })
    .check();
  await page.getByRole("button", { name: "检查分点方式" }).click();

  await page
    .getByLabel("“近两周相关用户投诉增加了。”所属分组")
    .selectOption("customer-impact");
  await page
    .getByLabel("“同一问题经常需要用户再次联系确认。”所属分组")
    .selectOption("customer-impact");
  await page
    .getByLabel("“最近三个任务中有两个发生延期。”所属分组")
    .selectOption("delivery-risk");
  await page
    .getByLabel("“关键里程碑依赖人工检查，容易被遗漏。”所属分组")
    .selectOption("delivery-risk");
  await page
    .getByLabel("“团队每周要花数小时重复返工。”所属分组")
    .selectOption("maintenance-cost");
  await page
    .getByLabel("“当前每次提交都需要两名同事手工核对。”所属分组")
    .selectOption("maintenance-cost");
  await page.getByRole("button", { name: "检查信息分组" }).click();
  await expect(page.getByText("三组信息清楚且不重复")).toBeVisible();
  await page.getByRole("button", { name: "进入三点独立练习" }).click();

  const answer = page.getByLabel("你的结论和三个要点");
  await answer.fill(
    "建议下一阶段优先优化新用户引导。第一，用户流失很多。第二，前三步用户流失严重。第三，流失影响转化。"
  );
  await page.getByRole("button", { name: "检查三个要点" }).click();
  await expect(page.getByText("分点还需要调整")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "完成第 5 课" })
  ).toHaveCount(0);

  await answer.fill(
    "建议下一阶段优先优化新用户引导。第一，用户流失集中在前三步。第二，相关客服咨询很多。第三，改动成本相对较低。"
  );
  await page.getByRole("button", { name: "检查三个要点" }).click();
  await expect(page.getByText("三个要点清楚且不重复")).toBeVisible();
  await page.getByRole("button", { name: "完成第 5 课" }).click();

  await expect(
    page.getByRole("heading", { name: "让多个信息各就各位" })
  ).toBeVisible();
  await expect(page.getByText("当前进度 5 / 7 课")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "第 6 天 完成一次完整工作汇报 已解锁"
    })
  ).toBeEnabled();
});

test("Day 6 先组装完整结构，再独立修改缺少行动请求的工作汇报", async ({
  page
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "stg:v0.5:progressive-course",
      JSON.stringify({
        version: 1,
        completedDays: [1, 2, 3, 4, 5],
        lessonViewedDays: [1, 2, 3, 4, 5],
        scaffoldUses: {},
        updatedAt: new Date().toISOString()
      })
    );
  });

  await page.goto("/training-demo");
  await page
    .getByRole("button", {
      name: "第 6 天 完成一次完整工作汇报 已解锁"
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "完成一次完整工作汇报" })
  ).toBeVisible();
  await expect(page.getByText("今天不是突然写一篇长文章")).toBeVisible();

  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "先给结论，再分点说明依据，最后提出有时限的行动请求。"
    })
    .check();
  await page.getByRole("button", { name: "检查汇报顺序" }).click();

  await page.getByLabel("1. 先给结论").selectOption("conclusion");
  await page.getByLabel("2. 第一项依据").selectOption("point-one");
  await page.getByLabel("3. 第二项依据").selectOption("point-two");
  await page.getByLabel("4. 行动请求").selectOption("request");
  await page.getByRole("button", { name: "检查完整结构" }).click();
  await expect(page.getByText("四个功能都在正确位置")).toBeVisible();
  await page
    .getByRole("button", { name: "进入完整汇报独立练习" })
    .click();

  const answer = page.getByLabel("你的 4–6 句完整汇报");
  await answer.fill(
    "建议将本周五发布推迟到下周一。第一，两个关键接口仍未通过联调。第二，最近三次测试有两次出现数据同步失败。第三，客户培训已经调整到下周一。以上是当前情况。"
  );
  await page.getByRole("button", { name: "检查完整汇报" }).click();
  await expect(page.getByText("一次只改最优先的缺口")).toBeVisible();
  await expect(page.getByText("待补 最后提出有时限的行动请求")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "完成第 6 课" })
  ).toHaveCount(0);

  await page.getByRole("button", { name: "查看提纲后修改原文" }).click();
  await expect(page.getByText("只给提纲，不给参考答案")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("你的 4–6 句完整汇报")).toHaveValue(
    "建议将本周五发布推迟到下周一。第一，两个关键接口仍未通过联调。第二，最近三次测试有两次出现数据同步失败。第三，客户培训已经调整到下周一。以上是当前情况。"
  );
  await expect(page.getByText("只给提纲，不给参考答案")).toBeVisible();
  await answer.fill(
    "建议将本周五发布推迟到下周一。第一，两个关键接口仍未通过联调。第二，最近三次测试有两次出现数据同步失败。第三，客户培训已经调整到下周一。请负责人今天批准将发布推迟到下周一。"
  );
  await page.getByRole("button", { name: "检查完整汇报" }).click();
  await expect(page.getByText("完整结构达标")).toBeVisible();
  await page.getByRole("button", { name: "完成第 6 课" }).click();

  await expect(
    page.getByRole("heading", {
      name: "完成了一次可行动的完整汇报"
    })
  ).toBeVisible();
  await expect(page.getByText("当前进度 6 / 7 课")).toBeVisible();
});

test("Day 7 冻结首稿、恢复主动修改并完成未见迁移，全程零外部请求", async ({
  page,
  baseURL
}) => {
  const forbiddenRequests: string[] = [];
  const appOrigin = new URL(baseURL!).origin;
  page.on("request", (request) => {
    const url = new URL(request.url());
    const isApiTransport = ["fetch", "xhr"].includes(request.resourceType());
    const isAppApi = url.origin === appOrigin && url.pathname.startsWith("/api/");
    const isExternalApi = url.origin !== appOrigin && isApiTransport;
    const isKnownModelOrDatabase =
      /(?:openai\.com|supabase\.(?:co|in))$/i.test(url.hostname);
    if (isAppApi || isExternalApi || isKnownModelOrDatabase) {
      forbiddenRequests.push(request.url());
    }
  });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "stg:v0.5:progressive-course",
      JSON.stringify({
        version: 1,
        completedDays: [1, 2, 3, 4, 5, 6],
        lessonViewedDays: [1, 2, 3, 4, 5, 6],
        scaffoldUses: { 2: 1, 5: 1 },
        updatedAt: new Date().toISOString()
      })
    );
  });

  await page.goto("/training-demo");
  await page
    .getByRole("button", {
      name: "第 7 天 毕业项目：独立完成结构化汇报 已解锁"
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "把前六天的方法独立用两次"
    })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "开始毕业项目" })
    .click();

  const original =
    "建议将客服工单系统切换推迟到下周一。第一，历史工单目前只迁移了60%。第二，试运行中有8%的附件缺失。第三，供应商预计两天可修复，旧系统合同持续到月底。以上是当前情况。";
  const revised =
    "建议将客服工单系统切换推迟到下周一。第一，历史工单目前只迁移了60%。第二，试运行中有8%的附件缺失。第三，供应商预计两天可修复，旧系统合同持续到月底。请运营总监今天批准将系统切换推迟到下周一。";
  await page.getByLabel("你的毕业项目首稿").fill(original);
  await page.getByRole("button", { name: "冻结首稿并查看证据" }).click();
  await expect(page.getByText("待补 最后提出有时限的行动请求")).toBeVisible();
  await expect(page.getByLabel("你的毕业项目首稿")).toHaveAttribute(
    "readonly",
    ""
  );
  await page
    .getByRole("button", { name: "在原稿上完成一次修改" })
    .click();
  await expect(page.getByLabel("修改稿（已为你预填首稿）")).toHaveValue(
    original
  );

  await page.reload();
  await expect(page.getByLabel("修改稿（已为你预填首稿）")).toHaveValue(
    original
  );
  await page.getByRole("button", { name: "检查我的修改" }).click();
  await expect(
    page.getByRole("heading", { name: "修改稿还没有发生变化" })
  ).toBeVisible();
  await page.getByLabel("修改稿（已为你预填首稿）").fill(revised);
  await page.getByRole("button", { name: "检查我的修改" }).click();
  await expect(page.getByText("主动修改证据成立")).toBeVisible();
  await page
    .getByRole("button", { name: "进入最后一个新场景" })
    .click();

  const transfer = page.getByLabel("你的新场景回答");
  await expect(transfer).toHaveValue("");
  await transfer.fill(revised);
  await page.getByRole("button", { name: "检查新场景回答" }).click();
  await expect(
    page.getByRole("heading", { name: "请直接完成当前工作汇报" })
  ).toBeVisible();
  await page.reload();
  await expect(transfer).toHaveValue(revised);

  const transferAnswer =
    "建议把剩余预算集中投放到渠道A。第一，渠道A获客成本82元、转化率7.8%，效率更高。第二，渠道B获客成本146元、转化率3.1%。第三，剩余预算只够一个渠道，且渠道A素材已审核。请市场负责人今天批准把剩余预算集中到渠道A。";
  await transfer.fill(transferAnswer);
  await page.getByRole("button", { name: "检查新场景回答" }).click();
  await expect(page.getByText("新场景回答达到当前规则")).toBeVisible();
  await page
    .getByRole("button", { name: "完成课程并记录迁移达标" })
    .click();
  await expect(
    page.getByRole("heading", { name: "七天训练完成 · 即时迁移达标" })
  ).toBeVisible();
  await expect(page.getByText("首次未达标，修改后达到规则")).toBeVisible();

  const browserEvidence = await page.evaluate(() => ({
    local: window.localStorage.getItem("stg:v0.5:progressive-course") ?? "",
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));
  expect(browserEvidence.local).not.toContain("客服工单系统");
  expect(browserEvidence.local).not.toContain("渠道A获客成本");
  expect(browserEvidence.overflow).toBeLessThanOrEqual(0);
  expect(forbiddenRequests).toEqual([]);
});

test("迁移待加强与毕业达标分开显示，并可从总结继续补练", async ({
  page
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "stg:v0.5:progressive-course",
      JSON.stringify({
        version: 1,
        completedDays: [1, 2, 3, 4, 5, 6, 7],
        lessonViewedDays: [1, 2, 3, 4, 5, 6, 7],
        scaffoldUses: {},
        daySevenOutcome: {
          ruleVersion: "stg-day-seven-rules-v2",
          projectInitialPassed: false,
          revisionKind: "improved",
          transferFirstPassed: false,
          transferFinalPassed: false,
          revisionAttempts: 1,
          transferAttempts: 1,
          completedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      })
    );
    window.sessionStorage.setItem(
      "stg:v0.5:progressive-session",
      JSON.stringify({
        version: 1,
        day: 7,
        stage: "complete",
        daySeven: {
          originalAnswer: "",
          originalChecked: true,
          projectInitialPassed: false,
          revisionAnswer: "",
          revisionChecked: true,
          transferAnswer: "",
          transferChecked: true,
          transferFirstPassed: false,
          projectAttempts: 1,
          revisionAttempts: 1,
          transferAttempts: 1
        }
      })
    );
  });

  await page.goto("/training-demo");
  await expect(
    page.getByRole("heading", { name: "七天流程已走完 · 迁移待加强" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "第 7 天 毕业项目：独立完成结构化汇报 流程完成 · 迁移待加强"
    })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "继续完成新场景迁移" })
    .click();
  await page
    .getByLabel("你的新场景回答")
    .fill(
      "建议把剩余预算集中投放到渠道A。第一，渠道A获客成本82元、转化率7.8%。第二，剩余预算只够支持一个渠道。请市场负责人今天批准把剩余预算集中到渠道A。"
    );
  await page.getByRole("button", { name: "检查新场景回答" }).click();
  await page
    .getByRole("button", { name: "完成课程并记录迁移达标" })
    .click();
  await expect(
    page.getByRole("heading", { name: "七天训练完成 · 即时迁移达标" })
  ).toBeVisible();
  await expect(page.getByText("首次未达标，修改后达到规则")).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("stg:v0.5:progressive-course") ?? "{}")
  );
  expect(saved.daySevenOutcome).toMatchObject({
    transferFirstPassed: false,
    transferFinalPassed: true,
    transferAttempts: 2
  });
});
