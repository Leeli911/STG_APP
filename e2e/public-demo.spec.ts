import { expect, test } from "@playwright/test";

test("首页进入公开 Demo，并完成一次采用建议的训练闭环", async ({
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
    const isKnownPaidService = /(?:openai\.com|supabase\.(?:co|in))$/i.test(
      url.hostname
    );

    if (isAppApi || isExternalApi || isKnownPaidService) {
      forbiddenRequests.push(request.url());
    }
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /把“我知道”练成/ })
  ).toBeVisible();
  await page.getByRole("link", { name: "立即体验公开演示" }).click();

  await expect(page).toHaveURL(/\/training-demo$/);
  await expect(page.getByRole("heading", { name: "训练体验题" })).toBeVisible();
  const answer = page.getByLabel("你的回答");
  const submitDraft = page.getByRole("button", { name: "提交回答" });
  await expect(answer).toHaveAttribute("id", "demo-answer");
  await answer.fill(
    "团队做决策时经常会遇到信息分散的问题。我希望通过数据分析帮助团队更快做出判断。"
  );
  await submitDraft.focus();
  await expect(submitDraft).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "训练反馈" })).toBeVisible();
  await expect(page.getByText("60", { exact: true })).toBeVisible();
  const acceptSuggestion = page.getByRole("button", { name: "采用修改建议" });
  await acceptSuggestion.focus();
  await expect(acceptSuggestion).toBeFocused();
  await page.keyboard.press("Enter");
  const submitRevision = page.getByRole("button", { name: "提交修订" });
  await submitRevision.focus();
  await expect(submitRevision).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("重新评分已完成")).toBeVisible();
  await expect(page.getByText("最终规则得分")).toBeVisible();
  await expect(page.getByText("+25", { exact: true })).toBeVisible();
  expect(forbiddenRequests).toEqual([]);
});
