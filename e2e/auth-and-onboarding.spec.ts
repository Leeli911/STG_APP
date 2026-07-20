import { expect, test } from "@playwright/test";

test("未登录访问受保护训练页会保留目标地址并跳转登录", async ({ page }) => {
  await page.goto("/workspace");

  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fworkspace$/);
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await expect(page.getByLabel("邮箱")).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();
});

test("开发认证可进入 Onboarding，且不依赖真实 Supabase", async ({ page }) => {
  await page.route("**/api/me/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { profile: null },
        requestId: "e2e-profile"
      })
    });
  });

  await page.goto("/login?redirectTo=/onboarding");
  await page.getByLabel("邮箱").fill("test@123.com");
  await page.getByLabel("密码").fill("123");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByRole("heading", { name: "设置你的训练目标" })
  ).toBeVisible();
  await expect(page.getByLabel("目标岗位")).toBeVisible();
  await expect(page.getByLabel("主要面试类型")).toBeVisible();
  await expect(page.getByLabel("希望改善什么")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "保存并开始训练" })
  ).toBeEnabled();
});
