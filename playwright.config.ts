import { defineConfig, devices, firefox } from "@playwright/test";
import { resolveBrowserExecutable } from "./tests/helpers/browserExecutable";

const enabled = process.env.EFLOW_E2E === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.EFLOW_E2E_BASE_URL || "http://127.0.0.1:5174",
    trace: "retain-on-failure",
  },
  webServer:
    !enabled || process.env.EFLOW_E2E_BASE_URL
      ? undefined
      : {
          command:
            "npm run dev:frontend -- --host 127.0.0.1 --port 5174 --strictPort",
          url: "http://127.0.0.1:5174",
          reuseExistingServer: true,
        },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: {
          executablePath: resolveBrowserExecutable(
            process.env.EFLOW_FIREFOX_EXECUTABLE || firefox.executablePath(),
          ),
        },
      },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
