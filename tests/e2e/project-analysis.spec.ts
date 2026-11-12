import { expect, test } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

test("opens project analysis from Browse views and inspects scoped task records", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await projectWorkspaceFixture(page, "head", false, { landingOnly: true });
  Object.assign(fixture.projects[0], { status: "completed", target_date: "2026-11-05", completed_at: "2026-11-03T09:00:00+08:00" });
  const taskId = fixture.tasks[0].id;
  await page.route("**/rest/v1/rpc/r7_work_activity", route => {
    expect(route.request().postDataJSON().p_roots).toEqual([taskId]);
    return route.fulfill({ json: {
      more: false,
      events: [{ id: "transfer", root_id: taskId, node_id: null, command: "root_lead", actor_name: "Alex Rivera",
        occurred_at: "2026-11-03T09:00:00+08:00",
        before_data: { root: { id: taskId, project: fixture.project, office: fixture.org, kind: "office", lead: "old" }, nodes: [], people: [{ id: "old", name: "Previous lead" }] },
        after_data: { root: { id: taskId, project: fixture.project, office: fixture.org, kind: "office", lead: "new" }, nodes: [], people: [{ id: "new", name: "New lead" }] },
      }],
    } });
  });
  await page.goto(`/projects?page=Projects&workspace=${fixture.org}&project=${fixture.project}&view=tasks`);
  await page.getByRole("button", { name: "Browse project views" }).click();
  await page.getByRole("dialog", { name: "Browse project views" }).getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Analytics", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Project summary" }).getByText("Completed 2 days early")).toBeVisible();
  await page.getByRole("button", { name: "View 2 tasks still open" }).click();
  const records = page.getByRole("table", { name: "Task records" });
  await expect(records.getByText("Confirm participants")).toHaveCount(0);
  await records.getByRole("button", { name: "Assignment history for Prepare community assessment" }).click();
  await expect(records.getByText("Lead: Previous lead → New lead")).toBeVisible();
  await page.getByRole("button", { name: "Show filters and funding" }).click();
  await expect(page.getByRole("group", { name: "Analytics filters" })).toBeVisible();
});
