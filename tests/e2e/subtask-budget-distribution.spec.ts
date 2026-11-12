import { expect, test } from "@playwright/test";
import { nestedWorkStaffingFixture } from "./fixtures/nestedWorkStaffing";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

test("the Task Lead can allocate and return an approved subtask budget", async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const records = await projectWorkspaceFixture(page, "head", false, { landingOnly: true });
  await nestedWorkStaffingFixture(page, records);
  const task = records.tasks[0];
  const subtask = records.subtasks[0];
  const source = "00000000-0000-4000-8000-000000000100";
  const allocation = "00000000-0000-4000-8000-000000000101";
  let amount = 0;
  await page.route("**/rest/v1/rpc/get_task_funding_context", route => route.fulfill({
    json: {
      taskId: task.id, funded: true, taskAllocationId: allocation, taskBudget: 50_000,
      taskLeaderId: records.id, canManageDistribution: true, available: 50_000 - amount,
      distribution: { allocated: amount, unallocated: 50_000 - amount, available: 50_000 - amount, released: 0, spent: 0 },
      parentSources: [{ id: source, name: "Supplies · FY 2026", available: 50_000 - amount }],
      subtaskBudgets: [{ id: subtask.id, title: subtask.title, amount, returnable: amount,
        capId: amount ? allocation : null, sourceId: amount ? source : null, finished: false }],
      lines: [],
    },
  }));
  await page.route("**/rest/v1/rpc/set_subtask_budget_cap", route => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({ p_task_id: task.id, p_subtask_id: subtask.id, p_parent_allocation_line_id: source, p_amount: 45_000 });
    amount = body.p_amount;
    return route.fulfill({ json: allocation });
  });
  await page.route("**/rest/v1/rpc/remove_subtask_budget_cap", route => {
    expect(route.request().postDataJSON().p_cap_allocation_id).toBe(allocation);
    amount = 0;
    return route.fulfill({ json: null });
  });

  await page.getByRole("navigation", { name: "Global navigation" }).getByRole("button", { name: "My Work", exact: true }).click();
  await page.getByRole("navigation", { name: "My Work destinations" }).getByRole("button", { name: "Leading", exact: true }).click();
  await page.locator("[data-personal-task]").filter({ hasText: task.title }).click();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Manage subtask budgets" }).click();
  const dialog = page.getByRole("dialog", { name: "Manage subtask budgets" });
  await dialog.getByRole("button", { name: "Allocate", exact: true }).click();
  const budget = dialog.getByRole("spinbutton", { name: /New budget/ });
  await budget.fill("50001");
  await expect(budget).toHaveAttribute("aria-invalid", "true");
  await budget.fill("45000");
  await dialog.getByLabel("Reason").fill("Materials and printing");
  await dialog.getByRole("button", { name: "Save budget" }).click();
  await expect(dialog.getByText("₱5,000.00", { exact: true })).toHaveCount(2);
  await page.screenshot({ path: info.outputPath("subtask-budget-manager.png") });
  await dialog.getByRole("button", { name: "Return unused" }).click();
  await dialog.getByLabel("Reason").fill("Supplies were donated");
  await dialog.getByRole("button", { name: "Confirm return" }).click();
  await expect(dialog.getByRole("status")).toContainText("Unused funding returned to the task");
  await expect(dialog.getByText("₱50,000.00", { exact: true })).toHaveCount(3);
});
