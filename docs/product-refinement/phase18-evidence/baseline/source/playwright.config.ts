import { defineConfig, devices } from "@playwright/test";

const enabled = process.env.EFLOW_E2E === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.EFLOW_E2E_BASE_URL || "http://127.0.0.1:5174",
    trace: "retain-on-failure",
  },
  webServer: !enabled || process.env.EFLOW_E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 5174",
        url: "http://127.0.0.1:5174",
        reuseExistingServer: true,
      },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
