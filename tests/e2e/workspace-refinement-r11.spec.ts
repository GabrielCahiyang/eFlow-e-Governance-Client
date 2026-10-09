import { test, expect, type Page } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
import { personalWorkspaceFixture } from "./fixtures/personalWorkspace";
import { readFile } from "node:fs/promises";
test.setTimeout(90_000);
async function historyFixture(page: Page) {
  const fixture = await projectWorkspaceFixture(page, "member");
  const state = {
    fail: -1,
    denied: false,
    events: Array.from({ length: 310 }, (_, i) => ({
      event_id: `progress:task:${String(310 - i).padStart(4, "0")}`,
      kind: i % 2 ? "status" : "progress",
      title: `History event ${310 - i}`,
      detail:
        "Recorded authorized fact with a longer description that wraps inside the history table.",
      actor_name: "Alex Rivera",
      occurred_at: "2026-10-01T10:00:00Z",
      task_id: fixture.tasks[0].id,
    })),
  };
  let seq = 0;
  const snapshots = new Map<string, typeof state.events>();
  await page.route("**/rest/v1/rpc/r11_project_activity", async (route) => {
    const args = route.request().postDataJSON();
    if (state.denied || args.p_page === state.fail)
      return route.fulfill({
        status: 400,
        json: { code: "42501", message: "Activity source unavailable" },
      });
    let snapshot = args.p_snapshot;
    if (!snapshot) {
      snapshot = `snapshot-${++seq}`;
      snapshots.set(
        snapshot,
        state.events.filter(
          (e) =>
            (args.p_kind === "all" || e.kind === args.p_kind) &&
            `${e.title} ${e.detail} ${e.actor_name}`
              .toLowerCase()
              .includes(args.p_search.trim().toLowerCase()) &&
            (!args.p_from ||
              Date.parse(e.occurred_at) >= Date.parse(args.p_from)) &&
            (!args.p_to || Date.parse(e.occurred_at) < Date.parse(args.p_to)),
        ),
      );
    }
    const events = snapshots.get(snapshot)!;
    const page = Math.min(
      args.p_page,
      Math.max(0, Math.floor((events.length - 1) / args.p_size)),
    );
    await route.fulfill({
      json: {
        snapshot,
        asOf: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        page,
        size: args.p_size,
        total: events.length,
        more: (page + 1) * args.p_size < events.length,
        events: events.slice(page * args.p_size, (page + 1) * args.p_size),
      },
    });
  });
  await page.goto(
    `/projects?workspace=${fixture.org}&project=${fixture.project}&view=activity`,
  );
  const history = page.getByRole("region", {
    name: "Project activity",
    exact: true,
  });
  await expect(history.getByText(/1.25 of 310 events/)).toBeVisible();
  return { fixture, state, history };
}
for (const width of [390, 1440])
  test(`R11 complete Activity at ${width}px with stable paging and full-history print`, async ({
    page,
    context,
  }, info) => {
    await page.setViewportSize({ width, height: 950 });
    const { state, history } = await historyFixture(page);
    await page.screenshot({
      path: info.outputPath(`r11-activity-${width}.png`),
      fullPage: true,
    });
    const ids: string[] = [];
    for (let index = 0; index < 13; index++) {
      ids.push(
        ...(await history
          .locator("tbody tr")
          .evaluateAll((rows) =>
            rows.map((row) => row.getAttribute("data-event-id")!),
          )),
      );
      if (index === 0)
        state.events.unshift({
          ...state.events[0],
          event_id: "new",
          title: "Concurrent event",
        });
      if (index < 12) {
        await history
          .getByRole("button", { name: "Next", exact: true })
          .click();
        await expect(
          history.getByText(`Page ${index + 2}`, { exact: false }),
        ).toBeVisible();
      }
    }
    expect(ids.length).toBe(310);
    expect(new Set(ids).size).toBe(310);
    await expect(
      history.getByText("History event 1", { exact: true }),
    ).toBeVisible();
    await expect(
      history.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    await history
      .getByRole("button", { name: "Prepare print" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`r11-activity-last-page-${width}.png`),
    });
    await history.getByRole("button", { name: "Prepare print" }).click();
    const dialog = page.getByRole("dialog", { name: "Activity print preview" });
    await expect(dialog).toBeVisible();
    const doc = page.frameLocator('iframe[title="Activity print document"]');
    await expect(doc.locator("tbody tr")).toHaveCount(310);
    await expect(
      doc.getByText("History event 1", { exact: true }),
    ).toBeVisible();
    await expect(
      doc.getByText("Concurrent event", { exact: true }),
    ).toHaveCount(0);
    const html = await dialog.locator("iframe").getAttribute("srcdoc");
    expect(html).toContain("All matching authorized events");
    expect(html).toContain("Asia/Singapore");
    expect(html).not.toContain("<nav");
    await expect(doc.locator('thead')).toHaveCSS('display', 'table-header-group');
    if (width === 1440 && info.project.name === 'chromium') {
      const printPage = await context.newPage();
      await printPage.setContent(html!);
      const pdf = await printPage.pdf({
        path: info.outputPath("r11-complete-history.pdf"),
        preferCSSPageSize: true,
        printBackground: true,
      });
      expect(
        (pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length,
      ).toBeGreaterThan(1);
      await printPage.close();
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await history.getByRole("button", { name: "Refresh history" }).click();
    await expect(history.getByText(/of 311 events/)).toBeVisible();
    if (width === 390) {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await history
        .getByRole("button", { name: "Prepare print" })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath("r11-activity-390-dark.png"),
      });
    }
  });
test("R11 filtering resets pages, current-page print is explicit, and failures never print a partial history", async ({
  page,
}) => {
  const { history, state } = await historyFixture(page);
  await history.getByRole("button", { name: "Next", exact: true }).click();
  await expect(history.getByText(/26.50 of 310/)).toBeVisible();
  await history.getByLabel("Filter activity type").selectOption("progress");
  await expect(history.getByText(/1.25 of 155/)).toBeVisible();
  await history.getByLabel("Events per page").selectOption("50");
  await expect(history.getByText(/1.50 of 155/)).toBeVisible();
  await history.getByLabel("Print scope").selectOption("page");
  await history.getByRole("button", { name: "Prepare print" }).click();
  await expect(
    page
      .frameLocator('iframe[title="Activity print document"]')
      .locator("tbody tr"),
  ).toHaveCount(50);
  await page.getByRole("button", { name: "Close print preview" }).click();
  await history.getByLabel("Print scope").selectOption("all");
  state.fail = 2;
  await history.getByRole("button", { name: "Prepare print" }).click();
  await expect(history.getByRole("alert")).toContainText("no partial document");
  await expect(
    page.getByRole("dialog", { name: "Activity print preview" }),
  ).toHaveCount(0);
  state.fail = -1;
  await history.getByLabel("From", { exact: true }).fill("2026-10-02");
  await expect(
    history.getByText("0 matching events", { exact: false }),
  ).toBeVisible();
  await history.getByRole("button", { name: "Clear activity filters" }).click();
  await expect(history.getByText(/of 310 events/)).toBeVisible();
  state.denied = true;
  await history.getByRole("button", { name: "Refresh history" }).click();
  await expect(history.getByRole("alert")).toContainText(
    "Activity source unavailable",
  );
  await expect(history.locator("tbody tr")).toHaveCount(0);
  state.denied = false;
  await history.getByRole("button", { name: "Retry history" }).click();
  await expect(history.getByText(/of 310 events/)).toBeVisible();
});
test("R11 project register retains hierarchy, filters, CSV and task drillthrough", async ({
  page,
}, info) => {
  const f = await projectWorkspaceFixture(page, "head");
  await page.goto(
    `/projects?workspace=${f.org}&project=${f.project}&view=reports`,
  );
  const report = page.getByRole("region", {
    name: "Project execution and financial register",
    exact: true,
  });
  await expect(
    report.getByRole("heading", {
      name: "Project execution and financial register",
    }),
  ).toBeVisible();
  await report
    .getByLabel("Search register")
    .fill("Prepare community assessment");
  await expect(
    report
      .getByRole("region", { name: "Execution register rows" })
      .locator("tbody tr"),
  ).toHaveCount(2);
  const secondaryColor = await report
    .locator(".eflow-analytics-caption")
    .evaluate((el) => getComputedStyle(el).color);
  expect(
    await report
      .locator("tbody tr")
      .first()
      .locator("td")
      .nth(1)
      .evaluate((el) => getComputedStyle(el).color),
  ).toBe(secondaryColor);
  const download = page.waitForEvent("download");
  await report.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv).toContain("Prepare community assessment");
  expect(csv).toContain("Gather supporting evidence");
  expect(csv).not.toContain("Coordinate Office briefing");
  await report
    .getByRole("button", { name: "Prepare community assessment", exact: true })
    .click();
  const inspector = page.getByRole("dialog", {
    name: "Task details: Prepare community assessment",
  });
  await expect(inspector).toBeVisible();
  await expect.poll(() => inspector.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(inspector).toHaveCount(0);
  await expect(report.getByRole("button", { name: "Prepare community assessment", exact: true })).toBeFocused();
  await report
    .getByRole("heading", { name: "Project execution and financial register" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("r11-register.png"),
    fullPage: true,
  });
});
test("R11 missing workflow facts withhold register metrics and exports", async ({
  page,
}) => {
  const f = await projectWorkspaceFixture(page, "head", false, {
    landingOnly: true,
  });
  await page.route("**/rest/v1/task_progress_updates*", (route) =>
    route.fulfill({
      status: 500,
      json: { message: "Workflow source unavailable" },
    }),
  );
  await page.goto(
    `/projects?workspace=${f.org}&project=${f.project}&view=reports`,
  );
  await expect(page.getByRole("alert")).toContainText(
    "Workflow source unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Retry workflow data" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Project execution and financial register",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(0);
});
test("R11 missing Activity deployment is explicit and archived history stays read-only", async ({
  page,
}) => {
  const f = await projectWorkspaceFixture(page, "member");
  f.projects[0].status = "archived";
  await page.route("**/rest/v1/rpc/r11_project_activity", (route) =>
    route.fulfill({
      status: 404,
      json: { code: "PGRST202", message: "Missing migration" },
    }),
  );
  await page.goto(
    `/projects?workspace=${f.org}&project=${f.project}&view=activity`,
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Complete Activity history is not installed" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare print" })).toHaveCount(
    0,
  );
});
test("R11 personal project Activity uses the same authorized contract and print context", async ({
  page,
}) => {
  const f = await personalWorkspaceFixture(page, { seed: true });
  await page.route("**/rest/v1/rpc/r11_project_activity", (route) =>
    route.fulfill({
      json: {
        snapshot: "personal-snapshot",
        asOf: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        page: 0,
        size: 25,
        total: 1,
        more: false,
        events: [
          {
            event_id: "personal:event",
            kind: "project",
            title: "Personal progress updated",
            detail: "Private project work",
            actor_name: "Owner",
            occurred_at: "2026-10-01",
            task_id: null,
          },
        ],
      },
    }),
  );
  await page.goto(`/projects?workspace=${f.personalId}&project=${f.projectId}`);
  await page.getByText("Project activity", { exact: true }).click();
  await expect(
    page.getByText("Personal progress updated", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Prepare print" }).click();
  await expect(
    page
      .frameLocator('iframe[title="Activity print document"]')
      .locator("tbody tr"),
  ).toHaveCount(1);
});
