import { expect, test } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

test.afterEach(async ({ page }) => {
  // A background profile refresh can outlive the test on a slow connection.
  // Cancel routing without turning its teardown into an auth/network error.
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

for (const storedRole of ["super_admin", "admin"]) {
  test(`${storedRole} sessions expose the unified Admin management surfaces`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1560, height: 1000 });
    const fixture = await projectWorkspaceFixture(page, "admin", false, {
      landingOnly: true,
    });
    Object.assign(fixture.profile, { role: storedRole });
    await page.goto("/users?page=All%20Users");
    const sidebar = page.locator(".eflow-productivity-sidebar").first();
    await expect(sidebar).toBeVisible({ timeout: 20_000 });
    const dismissTour = page.getByRole("button", { name: "Maybe later" });
    await dismissTour
      .waitFor({ timeout: 3000 })
      .then(() => dismissTour.click())
      .catch(() => {});
    await sidebar.hover();
    await sidebar
      .getByRole("button", { name: "Admin Center", exact: true })
      .click();
    await sidebar
      .getByRole("button", { name: "Role Defaults", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Role Defaults", exact: true }),
    ).toBeVisible();
    const rootCapabilities = page.getByRole("button", {
      name: "Admin: Allowed",
      exact: true,
    });
    await expect(rootCapabilities.first()).toBeVisible();
    expect(await rootCapabilities.count()).toBe(9);
    for (const capability of await rootCapabilities.all())
      await expect(capability).toBeDisabled();
    await expect(
      page.getByRole("columnheader", { name: "Admin", exact: true }),
    ).toHaveCount(2);
    await sidebar.hover();
    await sidebar
      .getByRole("button", { name: "User Access", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "User Access", exact: true }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search users…")).toBeVisible();
    await sidebar.hover();
    await sidebar
      .getByRole("button", { name: "All Users", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "User Management",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Create user" }).click();
    const dialog = page.getByRole("dialog", { name: "Create New User" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("option", { name: "Admin", exact: true }),
    ).toHaveCount(1);
    await expect(
      dialog.getByRole("option", { name: "Head", exact: true }),
    ).toHaveCount(1);
    await expect(
      dialog.getByRole("option", { name: "Super Admin", exact: true }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close dialog" }).click();
  });
}
