import { expect, test, type Page } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

const budgetId = "71000000-0000-4000-8000-000000000001";
async function sectionsFixture(page: Page, installed: boolean) {
  const fixture = await projectWorkspaceFixture(page, "head", false, { landingOnly: true });
  let sections = [{ id: "00000000-0000-4000-8000-000000000050", name: "Existing budget", amount: 123456.78, heldAmount: 0, position: 0 }];
  let version = 0;
  const writes: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/**", async route => {
    const request = route.request(), table = new URL(request.url()).pathname.split("/").at(-1)!;
    const payload = request.postData() ? request.postDataJSON() : {};
    if (table === "get_office_budget_sections") return installed
      ? route.fulfill({ json: { sections, version } })
      : route.fulfill({ status: 404, json: { code: "PGRST202", message: "Function not found in schema cache" } });
    if (table === "save_office_budget_sections") {
      writes.push(payload); sections = payload.p_sections; version++;
      return route.fulfill({ json: budgetId });
    }
    if (table === "department_budget_summary") return route.fulfill({ json: {
      id: budgetId, orgId: fixture.org, fiscalYear: 2026, status: "locked",
      approvedAmount: sections.reduce((sum, s) => sum + s.amount, 0), committedAmount: 0, spentAmount: 0,
      availableAmount: 123456.78, dailyPettyCashReleaseLimit: 30000, perReceiptLimit: 5000,
      liquidationDueDays: 15, allowReceiptLimitOverride: false, underutilizationThreshold: 75,
    } });
    if (table === "department_fiscal_budgets") return route.fulfill({ json: [{ fiscal_year: 2026, status: "locked", approved_amount: 123456.78 }] });
    if (["department_budget_lines", "budget_commitments", "budget_ledger_entries", "department_budget_adjustments", "petty_cash_requests", "general_journal_entries"].includes(table)) return route.fulfill({ json: [] });
    return route.fallback();
  });
  await page.goto("/office-budget?page=Office%20Budget&view=annual&fy=2026");
  await expect(page.getByRole("heading", { name: "Annual office budget", exact: true })).toBeVisible();
  return { writes };
}

test("unavailable sections never display an existing saved budget as zero", async ({ page }) => {
  await sectionsFixture(page, false);
  const workspace = page.locator(".eflow-budget-workspace");
  await expect(workspace.getByText("₱123,456.78", { exact: true })).toHaveCount(2);
  await expect(workspace.getByText(/No sections yet/)).toHaveCount(0);
  await expect(workspace.getByText("₱0.00", { exact: true })).toHaveCount(0);
  await expect(workspace.getByRole("button", { name: /Reclassify/ })).toHaveCount(0);
});

test("locked section adjustments update the counter and persist without duplicated writes", async ({ page }) => {
  const { writes } = await sectionsFixture(page, true);
  await page.getByRole("button", { name: /Reclassify/ }).click();
  await page.getByLabel(/Section name/).fill("Office Supplies");
  await page.getByLabel("Budget amount Office Supplies", { exact: true }).fill("300000");
  await page.getByRole("button", { name: "Add section", exact: true }).click();
  await page.getByLabel(/Section name/).nth(1).fill("Training");
  await page.getByLabel("Budget amount Training", { exact: true }).fill("50000");
  await expect(page.getByText("₱350,000.00", { exact: true })).toBeVisible();
  await page.getByLabel(/Required adjustment reason/).fill("Approved authority QA-reference");
  await page.getByRole("button", { name: "Record section adjustment", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Record adjustment", exact: true }).click();
  await expect(page.getByText("Section adjustment recorded.", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].p_sections).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Office Supplies", amount: 300000 }), expect.objectContaining({ name: "Training", amount: 50000 })]));
  await page.reload();
  await expect(page.getByLabel(/Section name/).nth(0)).toHaveValue("Office Supplies");
  await expect(page.getByLabel(/Section name/).nth(1)).toHaveValue("Training");
  await expect(page.getByText("₱350,000.00", { exact: true })).toBeVisible();
});
