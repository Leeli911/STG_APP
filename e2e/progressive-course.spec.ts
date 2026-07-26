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
      name: "Day 3 把结论放到第一句 后续开发"
    })
  ).toBeDisabled();

  await page.reload();
  await expect(page.getByLabel("用一句话写出你的明确目的")).toHaveValue(
    "本期预算已使用九成，请负责人批准缩小本期范围。"
  );
  await expect(page.getByText("句式骨架")).toBeVisible();
});
