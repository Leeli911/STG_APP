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
    .getByRole("button", { name: "进入 Day 2：写一句明确目的" })
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
  await expect(page.getByText("当前完成 2 / 7 课")).toBeVisible();
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
      name: "Day 3 把结论放到第一句 未解锁"
    })
  ).toBeDisabled();

  await page.reload();
  await expect(page.getByLabel("用一句话写出你的明确目的")).toHaveValue(
    "本期预算已使用九成，请负责人批准缩小本期范围。"
  );
  await expect(page.getByText("句式骨架")).toBeVisible();
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
      name: "Day 3 把结论放到第一句 已解锁"
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
  await expect(page.getByText("当前完成 3 / 7 课")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Day 4 用一个理由支撑结论 已解锁"
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
      name: "Day 4 用一个理由支撑结论 已解锁"
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
  await expect(page.getByText("当前完成 4 / 7 课")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Day 5 把信息整理成两到三点 后续开发"
    })
  ).toBeDisabled();
});
