import { expect, test } from "@playwright/test";

test("admin user dialog and citywide plan approvals remain usable on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const quickLogin = page.getByRole("button", { name: "Choose a development account" });
  test.skip(!(await quickLogin.isVisible()), "Local development account shortcuts are unavailable.");
  await quickLogin.click();
  await page.getByRole("menuitem", { name: /^Admin —/ }).click();
  await page.getByRole("button", { name: "Open navigation" }).waitFor();
  const dismissTour = page.getByRole("button", { name: "Maybe later" });
  await dismissTour.waitFor({ timeout: 3000 }).then(() => dismissTour.click()).catch(() => {});

  await page.getByRole("button", { name: "Open navigation" }).click();
  const sidebar = page.locator(".eflow-mobile-navigation .eflow-productivity-sidebar");
  const navItem = sidebar.locator('[data-tour-section="dashboard"] .eflow-productivity-sidebar__item');
  const activeSurface = sidebar.locator('[data-tour-section="dashboard"] .eflow-productivity-sidebar__active-surface');
  await expect(navItem).toBeVisible();
  const [sidebarBounds, itemBounds, surfaceBounds] = await Promise.all([
    sidebar.boundingBox(), navItem.boundingBox(), activeSurface.boundingBox(),
  ]);
  expect(sidebarBounds).not.toBeNull();
  expect(itemBounds).not.toBeNull();
  expect(surfaceBounds).not.toBeNull();
  expect(sidebarBounds!.x).toBeLessThanOrEqual(1);
  expect(itemBounds!.x).toBeGreaterThanOrEqual(sidebarBounds!.x);
  expect(surfaceBounds!.x).toBeGreaterThanOrEqual(sidebarBounds!.x);
  expect(Math.abs(surfaceBounds!.x - itemBounds!.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(surfaceBounds!.width - itemBounds!.width)).toBeLessThanOrEqual(2);
  await page.locator('.eflow-mobile-navigation [data-tour-section="users"] .eflow-productivity-sidebar__item').click();
  await page.locator('.eflow-mobile-navigation [data-tour-section="users"] .eflow-productivity-sidebar__subpage', { hasText: "All Users" }).click();
  await page.getByRole("button", { name: "Create user" }).click();
  const userDialog = page.getByRole("dialog", { name: "Create New User" });
  await expect(userDialog).toBeVisible();
  const userBounds = await userDialog.boundingBox();
  expect(userBounds).not.toBeNull();
  expect(userBounds!.x).toBeGreaterThanOrEqual(0);
  expect(userBounds!.x + userBounds!.width).toBeLessThanOrEqual(320);
  await expect(userDialog.getByPlaceholder("Juan Dela Cruz")).toBeVisible();
  await userDialog.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator('.eflow-mobile-navigation [data-tour-section="projects"] .eflow-productivity-sidebar__item').click();
  await expect(page.getByRole("heading", { name: "Citywide plans and projects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Department approval tracking" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create work plan" })).toHaveCount(0);
  await expect(page.getByText("Select or create a work plan", { exact: true })).toHaveCount(0);
});

test("department work-plan creation remains available and fits a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const quickLogin = page.getByRole("button", { name: "Choose a development account" });
  test.skip(!(await quickLogin.isVisible()), "Local development account shortcuts are unavailable.");
  await quickLogin.click();
  await page.getByRole("menuitem", { name: /^BPLO Head —/ }).click();
  await page.getByRole("button", { name: "Open navigation" }).waitFor();
  const dismissTour = page.getByRole("button", { name: "Maybe later" });
  await dismissTour.waitFor({ timeout: 3000 }).then(() => dismissTour.click()).catch(() => {});
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator('.eflow-mobile-navigation [data-tour-section="projects"] .eflow-productivity-sidebar__item').click();
  await page.getByRole("button", { name: "Create work plan" }).first().click();
  const planDialog = page.getByRole("dialog", { name: "Create a work plan" });
  await expect(planDialog).toBeVisible();
  const planInput = planDialog.getByPlaceholder(/2026 Coastal/i);
  await expect(planInput).toBeVisible();
  expect((await planInput.boundingBox())!.width).toBeGreaterThan(150);
  await planDialog.getByRole("button", { name: "Import proposal", exact: true }).click();
  await expect(planDialog.getByText("Drop a government proposal PDF here", { exact: true })).toBeVisible();
  await planDialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(planDialog).toHaveCount(0);
});
