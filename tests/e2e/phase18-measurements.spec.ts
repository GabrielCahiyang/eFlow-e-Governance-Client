import { test, expect } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
import { phase16FinancialFixture } from "./fixtures/phase16Financial";

test.setTimeout(180_000);
// Opt-in production measurement, never a skipped release gate.
const measure = process.env.EFLOW_PERFORMANCE === "1" ? test : test.skip;
for (const size of [100, 1000, 5000])
  measure(
    `production project ${size} tasks: three measured samples`,
    async ({ page }, info) => {
      const data = await projectWorkspaceFixture(page, "head", false, {
        landingOnly: true,
      });
      const seed = data.tasks[0];
      data.tasks.splice(
        0,
        data.tasks.length,
        ...Array.from({ length: size }, (_, i) => ({
          ...seed,
          id: `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
          title: `Benchmark task ${i}`,
          workspace_position: i,
          description: "Representative project task with supporting details.",
        })),
      );
      const samples = [];
      for (let run = 0; run < 3; run++) {
        await page.evaluate(
          (key) => {
            // R3 scopes filters to the workspace. Clear both the historical
            // key and its workspace variants before each unfiltered sample.
            for (const stored of Object.keys(localStorage))
              if (stored === key || stored.startsWith(`${key}:workspace:`)) localStorage.removeItem(stored);
          },
          `eflow_project_views_v1_${data.id}_${data.project}`,
        );
        let reads = 0,
          bytes = 0;
        const count = (request: import("@playwright/test").Request) => {
          if (request.url().includes("/rest/v1/")) reads++;
        };
        const payload = async (
          response: import("@playwright/test").Response,
        ) => {
          if (new URL(response.url()).pathname.startsWith("/assets/"))
            bytes += (await response.body().catch(() => Buffer.alloc(0)))
              .length;
        };
        page.on("request", count);
        page.on("response", payload);
        const start = performance.now();
        await page.goto(
          `/projects?page=Projects&project=${data.project}&view=tasks`,
        );
        // R7's current reader and the historical reader order these rows
        // differently. Wait for the same task and full population in both.
        await expect(page.locator(".pt-task-row").filter({ hasText: "Benchmark task 0" })).toContainText(
          "Benchmark task 0",
          { timeout: 90_000 },
        );
        await expect(page.locator(".pt-task-row")).toHaveCount(size);
        // DOM presence can precede the initial table layout/font paint. Finish
        // that route work before measuring a separate filter interaction.
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
        });
        const readyMs = performance.now() - start;
        const dom = await page.evaluate(() => ({
          nodes: document.querySelectorAll("*").length,
          memory: (
            performance as Performance & { memory?: { usedJSHeapSize: number } }
          ).memory?.usedJSHeapSize,
        }));
        const filterStart = performance.now();
        await page
          .getByRole("textbox", { name: "Search project tasks", exact: true })
          .fill(`Benchmark task ${size - 1}`);
        await expect(page.locator(".pt-task-row")).toHaveCount(1);
        await page.evaluate(
          () =>
            new Promise<void>((done) =>
              requestAnimationFrame(() => requestAnimationFrame(() => done())),
            ),
        );
        samples.push({
          run,
          readyMs,
          filterMs: performance.now() - filterStart,
          restReads: reads,
          assetBytes: bytes,
          ...dom,
        });
        page.off("request", count);
        page.off("response", payload);
      }
      await info.attach(`project-${size}`, {
        body: JSON.stringify(
          {
            stage: process.env.EFLOW_PERF_STAGE,
            timingModel: "paint-ready-v2",
            size,
            browser: info.project.name,
            samples,
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    },
  );

measure(
  "production Accounting journal scoped request count",
  async ({ page }, info) => {
    await phase16FinancialFixture(page);
    const samples = [];
    for (let run = 0; run < 3; run++) {
      let reads = 0;
      const count = (request: import("@playwright/test").Request) => {
        if (
          new URL(request.url()).pathname.endsWith("/general_journal_entries")
        )
          reads++;
      };
      page.on("request", count);
      const start = performance.now();
      await page.goto("/general-journal?page=General%20Journal");
      await expect(
        page.getByRole("button", { name: "Refresh journal", exact: true }),
      ).toBeVisible();
      await page.waitForLoadState("networkidle");
      samples.push({
        run,
        readyMs: performance.now() - start,
        journalReads: reads,
      });
      page.off("request", count);
    }
    await info.attach("accounting-journal", {
      body: JSON.stringify(
        {
          stage: process.env.EFLOW_PERF_STAGE,
          browser: info.project.name,
          samples,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  },
);
