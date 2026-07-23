import { expect, test } from "@playwright/test";

test("从首页进入免费训练，并完成结论先行的冷答、重写与迁移", async ({
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
  await expect(
    page.getByRole("heading", { name: /把“知道方法”练成/ })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "不是帮你把这一次写得更好，而是训练你下一次自己说清楚"
    })
  ).toBeVisible();
  await page.getByRole("link", { name: "开始免费五分钟训练" }).click();

  await expect(page).toHaveURL(/\/training-demo$/);
  await expect(
    page.getByRole("heading", { name: "五分钟结构化表达训练" })
  ).toBeVisible();
  await expect(page.getByText("结论先行", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "第 2 天 职场短答" }).click();
  const draft = page.getByLabel("你的无提示回答");
  const submitDraft = page.getByRole("button", { name: "提交冷回答" });
  await expect(draft).toHaveValue("");
  await draft.fill(
    "目前核心功能已经完成，但还有几个联调问题。项目存在上线风险，我建议先解决联调问题再发布。"
  );
  await submitDraft.focus();
  await expect(submitDraft).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("先自己检查")).toBeVisible();
  await page
    .getByLabel("我的核心结论")
    .fill("项目存在上线风险，我建议先解决联调问题再发布。");
  await page.getByRole("button", { name: "查看单点反馈" }).click();

  await expect(page.getByRole("heading", { name: "结论先行" })).toBeVisible();
  await expect(
    page.getByText("完成任务的核心判断出现在开场铺垫之后。")
  ).toBeVisible();
  await expect(page.getByText("原文证据")).toBeVisible();
  await expect(page.getByRole("button", { name: /采用/ })).toHaveCount(0);

  await page
    .getByLabel("亲自重写")
    .fill(
      "项目存在上线风险，我建议先解决联调问题再发布。目前核心功能已经完成，但几个联调问题可能影响周五上线。"
    );
  await page.getByRole("button", { name: "检查我的重写" }).click();
  await expect(page.getByRole("heading", { name: "重写结果" })).toBeVisible();
  await page.getByRole("button", { name: "进入迁移练习" }).click();

  await expect(
    page.getByText("两个成本相近的方案应该选哪个？", { exact: false })
  ).toBeVisible();
  await page
    .getByLabel("你的迁移回答")
    .fill(
      "建议选择方案二，因为它的上线风险更低。两个方案成本相近，因此风险差异是当前更关键的判断依据。"
    );
  await page.getByRole("button", { name: "提交迁移回答" }).click();
  await page
    .getByLabel("迁移题核心结论")
    .fill("建议选择方案二，因为它的上线风险更低。");
  await page.getByRole("button", { name: "检查迁移结果" }).click();

  await expect(
    page.getByRole("heading", { name: "已在新情境中独立使用" })
  ).toBeVisible();
  await expect(page.getByText("当前浏览器已完成 1 次训练闭环")).toBeVisible();
  await expect(page.getByText("其中 1 次迁移达标")).toBeVisible();
  await expect(page.getByText(/\d+\s*%/)).toHaveCount(0);
  expect(forbiddenRequests).toEqual([]);
});

test("无关回答不能通过复制自填核心句刷成明确目的达标", async ({
  page
}) => {
  await page.goto("/training-demo");
  await page
    .getByLabel("你的无提示回答")
    .fill("我们今天讨论了字体颜色和按钮大小，会议记录也已经整理完成。");
  await page.getByRole("button", { name: "提交冷回答" }).click();
  await page
    .getByLabel("我的核心结论")
    .fill("我们今天讨论了字体颜色和按钮大小。");
  await page.getByRole("button", { name: "查看单点反馈" }).click();

  await expect(page.getByText("未完成本题任务")).toBeVisible();
  await expect(page.getByText("本次重点修改")).toBeVisible();
  await expect(page.getByText("自检与原文一致")).toHaveCount(0);
});

test("刷新后恢复尚未完成的训练步骤和本地回答", async ({ page }) => {
  await page.goto("/training-demo");
  const answer =
    "项目会延期三天，我建议把发布日期调整到下周一，请主管今天确认。";
  await page.getByLabel("你的无提示回答").fill(answer);
  await page.getByRole("button", { name: "提交冷回答" }).click();
  await expect(page.getByText("先自己检查")).toBeVisible();

  await page.reload();

  await expect(page.getByText("先自己检查")).toBeVisible();
  await expect(page.getByText(answer)).toBeVisible();
});

test("两到三点必须是不同且相关的内容", async ({ page }) => {
  await page.goto("/training-demo");
  await page.getByRole("button", { name: "第 3 天 职场短答" }).click();
  await page
    .getByLabel("你的无提示回答")
    .fill(
      "我建议优化新用户引导，主要有三点。第一点，前三步流失高。第二点，客服咨询很多。第三点，改动成本较低。"
    );
  await page.getByRole("button", { name: "提交冷回答" }).click();
  await page
    .getByLabel("我的核心结论")
    .fill("我建议优先优化新用户引导。");
  await page.getByRole("button", { name: "查看单点反馈" }).click();

  await expect(
    page.getByText("回答明确给出 3 个部分，并覆盖了 3 个不同理由。")
  ).toBeVisible();
  await expect(page.getByText("任务信息完整")).toBeVisible();
});

test("到期记录可以进入24小时间隔冷测并单独保存结果", async ({
  page
}) => {
  await page.addInitScript(() => {
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
  });
  await page.goto("/training-demo");
  await page.getByRole("button", { name: "开始今日冷测" }).click();
  await expect(page.getByText("24 小时间隔冷测")).toBeVisible();

  await page
    .getByLabel("你的冷测回答")
    .fill("合同尚未签署，我建议延后项目启动，请业务负责人今天确认。");
  await page.getByRole("button", { name: "提交冷测回答" }).click();
  await page
    .getByLabel("冷测核心结论")
    .fill("合同未签，需要负责人确认延后项目启动。");
  await page.getByRole("button", { name: "检查冷测结果" }).click();

  await expect(
    page.getByRole("heading", { name: "间隔后仍在新情境中做到" })
  ).toBeVisible();
  const delayedStatus = await page.evaluate(() => {
    const value = window.localStorage.getItem(
      "stg:v0.4:structured-practice-progress"
    );
    return value ? JSON.parse(value)[0]?.delayedStatus : null;
  });
  expect(delayedStatus).toBe("met");
});
