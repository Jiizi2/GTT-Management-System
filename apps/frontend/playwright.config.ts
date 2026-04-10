import { defineConfig } from "@playwright/test";

const isWindows = process.platform === "win32";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: isWindows
    ? [
        {
          name: "msedge",
          use: {
            browserName: "chromium",
            channel: "msedge",
          },
        },
      ]
    : [
        {
          name: "chromium",
          use: {
            browserName: "chromium",
          },
        },
      ],
});
