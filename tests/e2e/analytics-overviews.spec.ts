import { test, expect } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
for (const role of ["head", "member", "accounting_staff"] as const)
  test(`${role}: role overview and analytics entrances`, async ({
    page,
  }, info) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const records = await projectWorkspaceFixture(page, role, false, {
      landingOnly: true,
    });
    if (role === "head") {
      await expect(
        page.getByRole("heading", { name: "Office overview", exact: true }),
      ).toBeVisible({ timeout: 45000 });
      await expect(
        page.getByRole("region", { name: "Task status", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await page.screenshot({
        path: info.outputPath("head-login-overview.png"),
        fullPage: true,
      });
      await page.goto(
        `/team-supervision?page=Analytics&workspace=${records.org}`,
      );
      await expect(
        page.getByRole("heading", { name: "Project & Employee Analytics" }),
      ).toBeVisible({ timeout: 45000 });
      await expect(
        page.getByRole("table", { name: "Project analytics", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await page
        .getByRole("group", { name: "Analytics sections" })
        .getByRole("button", { name: "Employee analytics", exact: true })
        .click();
      await expect(
        page.getByRole("table", { name: "People delivery analytics" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Employee 360", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Recent delivery activity" }),
      ).toBeVisible();
      await page.screenshot({
        path: info.outputPath("employee-analytics-360.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Workload & health", exact: true })
        .click();
      await expect(
        page.getByText("Work health shows workload pressure", { exact: false }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Skills coverage", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: /Skills and continuity coverage/i }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Project analytics", exact: true })
        .click();
      await page.getByRole("combobox", { name: /^Project/ }).selectOption(records.project);
      await expect(page.getByRole("heading", { name: "Project analysis", exact: true })).toBeVisible();
      await page.getByRole("combobox", { name: /^Project/ }).selectOption("");
      await expect(page.getByRole("region", { name: "Project completion", exact: true })).toBeVisible();
      await page.goto(
        `/projects?page=Projects&workspace=${records.org}&project=${records.project}&view=analytics`,
      );
      await expect(
        page.getByRole("tab", { name: "Analytics", exact: true }),
      ).toBeVisible({ timeout: 45000 });
      await expect(
        page.getByRole("table", { name: "Task records", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await page.setViewportSize({ width: 1100, height: 950 });
      await page.screenshot({
        path: info.outputPath("project-analytics-1100.png"),
        fullPage: true,
      });
    } else if (role === "member") {
      await expect(
        page.getByRole("heading", { name: "My work overview", exact: true }),
      ).toBeVisible({ timeout: 45000 });
      await expect(
        page.getByRole("region", { name: "My task status" }),
      ).toBeVisible();
      await page
        .getByRole("region", { name: "My task status" })
        .getByRole("button", { name: /Completed/ })
        .click();
      await expect(
        page.getByRole("button", { name: "Clear chart selection" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Clear chart selection" }).click();
      await page.getByRole("button", { name: "Overdue", exact: true }).click();
      await page.screenshot({
        path: info.outputPath("member-login-overview.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Open My Work", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "My Work", exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: "Accounting Overview", exact: true }),
      ).toBeVisible({ timeout: 45000 });
      await expect(
        page.getByRole("region", { name: "Released cash breakdown" }),
      ).toBeVisible({ timeout: 30000 });
      await page.route("**/rest/v1/rpc/office_petty_cash_snapshot", (route) =>
        route.fulfill({
          json: {
            ceiling: 30000,
            receiptLimit: 5000,
            cash: 30000,
            reserved: 0,
            available: 30000,
            outstanding: 0,
            replenishable: 0,
            requests: [],
            events: [],
          },
        }),
      );
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Office petty cash", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("₱30,000.00", { exact: true })).toBeVisible();
      await page.screenshot({
        path: info.outputPath("accounting-login-overview.png"),
        fullPage: true,
      });
    }
  });

test("Head analytics stays readable at a narrower desktop width in dark mode", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1100, height: 950 });
  await projectWorkspaceFixture(page, "head", false, {
    landingOnly: true,
    theme: "dark",
  });
  await expect(
    page.getByRole("heading", { name: "Office overview", exact: true }),
  ).toBeVisible({ timeout: 45000 });
  await expect(
    page.getByRole("region", { name: "Task status", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("head-overview-dark-1100.png"),
    fullPage: true,
  });
});
