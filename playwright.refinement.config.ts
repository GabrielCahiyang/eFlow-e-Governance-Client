import { defineConfig } from "@playwright/test";
import release from "./playwright.release.config";

// R1's isolated component harness is tested separately against the dev server;
// actual-project R1 cases and all later refinement cases run on production assets.
export default defineConfig(release, {
  testMatch: [
    release.testMatch!,
    /workspace-refinement-r(?:[1-9]|1[0-3])\.spec\.ts/,
    /phase65-office-identities\.spec\.ts/,
    /(?:account-lockout|office-budget-sections|project-office-recovery-removal|project-office-single-table)\.spec\.ts/,
  ],
  grepInvert: /R1 foundation scroll, badges and tooltip focus|R1 main content and sidebar reach their final item/,
  reporter: [
    ["list"],
    ["json", { outputFile: ".refinement/release-report.json" }],
  ],
  outputDir: ".refinement/release-results",
});
