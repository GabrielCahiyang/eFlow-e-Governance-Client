import { expect, test, type Page } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

const views = [
  ["tasks", ".pt-task-row"],
  ["board", ".pv-board"],
  ["gantt", ".pv-gantt"],
  ["calendar", ".eflow-project-calendar"],
  ["dashboard", ".pv-dashboard"],
  ["analytics", ".ea-workspace"],
  ["offices", "#project-office-search"],
  ["settings", ".pf-panel"],
  ["members", ".r7-members"],
  ["overview", ".r4-project-overview"],
  ["timeline", ".eflow-project-timeline"],
  ["reports", '[aria-label="Project execution and financial register"]'],
  ["proposal_context", ".eflow-project-command >> text=No Originating Proposal"],
  ["activity", '[aria-label="Project activity"]'],
  ["reviews", "h2 >> text=Project review queue"],
  ["budget", ".pf-panel"],
] as const;

async function showView(page: Page, view: string) {
  await page.evaluate(view => {
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    history.replaceState(history.state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, view);
}

test("project views use their own loading layouts and restore the loaded workspace", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = await projectWorkspaceFixture(page, "head", false, { landingOnly: true });
  let unblock!: () => void;
  const pending = new Promise<void>(resolve => { unblock = resolve; });
  await page.route(/\/rest\/v1\/task_progress_updates\?.*task_id=/, async route => {
    await pending;
    await route.fulfill({ json: [] });
  });
  await page.goto(`/projects?page=Projects&workspace=${fixture.org}&project=${fixture.project}&view=tasks`);
  const loader = page.getByRole("status", { name: "Loading project view" });
  const samples = new Set<string>();
  try {
    for (const [view] of views) {
      await showView(page, view);
      const layout = loader.locator(`[data-project-loading-view="${view}"]`);
      await expect(layout).toBeVisible({ timeout: 25_000 });
      samples.add(await layout.evaluate(node => node.innerHTML));
      await layout.screenshot({ path: info.outputPath(`${view}-loading.png`) });
    }
    expect(samples.size).toBe(views.length);
  } finally {
    unblock();
  }
  await expect(loader).toHaveCount(0);

  for (const [view, selector] of views) {
    await showView(page, view);
    const content = page.locator(selector).first();
    await expect(content).toBeVisible();
    await content.screenshot({ path: info.outputPath(`${view}-loaded.png`) });
    await expect(loader).toHaveCount(0);
  }
});
