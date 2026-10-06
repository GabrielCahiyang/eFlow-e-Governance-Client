import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Critical fixtures intercept backend traffic; performance is a separate opt-in run.
// defineConfig concatenates webServer settings; omit the development server.
const { webServer: _developmentServer, ...shared } = base;
export default defineConfig(shared, {
  forbidOnly: true,
  retries: 0,
  testMatch:
    /(?:phase(?:1-authority|2-invitations|3-project-table|5-project-import|6-project-offices|7-readiness-staffing|10-project-workspace|11-main-table|12-shared-inspector|13-personal-work|14-people-collaboration|15-ai-governance|16-support-finance|17-safety|18-release|18-preview|18-surfaces)|project-workspace-controls|admin-unification|navigation-v2)\.spec\.ts/,
  webServer: process.env.EFLOW_E2E_BASE_URL
    ? undefined
    : {
        command:
          "npm run build && npx vite preview --host 127.0.0.1 --port 5174 --strictPort",
        url: "http://127.0.0.1:5174",
        reuseExistingServer: false,
        timeout: 120_000,
      },
  workers: 2,
  reporter: [
    ["list"],
    ["json", { outputFile: ".phase18/release-report.json" }],
  ],
  outputDir: ".phase18/release-results",
});
