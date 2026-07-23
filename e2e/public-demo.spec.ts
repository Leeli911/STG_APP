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
  await expect(page.getByText("核心结论到第 2 句才出现。")).toBeVisible();
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

  await page
    .getByLabel("你的迁移回答")
    .fill(
      "投诉增加的主要原因是新版本登录异常，团队正在回滚。异常从昨晚开始，预计今天恢复。"
    );
  await page.getByRole("button", { name: "提交迁移回答" }).click();
  await page
    .getByLabel("迁移题核心结论")
    .fill("投诉增加的主要原因是新版本登录异常，团队正在回滚。");
  await page.getByRole("button", { name: "检查迁移结果" }).click();

  await expect(
    page.getByRole("heading", { name: "已在新情境中独立使用" })
  ).toBeVisible();
  await expect(page.getByText("当前浏览器已完成 1 次迁移练习")).toBeVisible();
  await expect(page.getByText(/\d+\s*%/)).toHaveCount(0);
  expect(forbiddenRequests).toEqual([]);
});
