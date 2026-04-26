import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/preparePlaywrightEnv.mjs 8180 && PORT=8180 pnpm --dir apps/api dev:test",
      url: "http://localhost:8180/health",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "node tests/e2e/preparePlaywrightEnv.mjs 3100 && PORT=3100 NEXT_DIST_DIR=.next-dev-e2e NEXT_PUBLIC_API_BASE_URL=http://localhost:8180 NEXT_PUBLIC_ENABLE_TEST_DEMO_AUTH=true pnpm --dir apps/web dev",
      url: "http://localhost:3100",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  globalSetup: "./tests/e2e/global.setup.ts",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
