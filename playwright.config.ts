import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const useSystemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "1";
const testsPublishedDemo = Boolean(process.env.PUBLIC_DEMO_URL);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "output/playwright/test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "output/playwright/report", open: "never" }]]
    : "list",
  use: {
    baseURL,
    locale: "zh-CN",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: useSystemChrome ? "off" : "retain-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {})
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {})
      }
    }
  ],
  webServer: testsPublishedDemo
    ? undefined
    : {
        command: `npm --workspace apps/web run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: "1",
          STG_AI_MODE: "mock",
          STG_AI_EXECUTION_MODE: "sync",
          LIVE_TRAINING_V2: "true",
          STG_ENABLE_DEV_AUTH: "true",
          STG_ENABLE_DEV_ADMIN: "false"
        }
      }
});
