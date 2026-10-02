import { expect, test } from "@playwright/test";

test.afterEach(async ({ page }) => {
  // A background profile refresh can outlive the test on a slow connection.
  // Cancel routing without turning its teardown into an auth/network error.
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

for (const storedRole of ["super_admin", "admin"]) {
  test(`${storedRole} sessions expose the unified Admin management surfaces`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1560, height: 1000 });
    // The live development account uses the legacy key. For the second run,
    // adapt only its profile response; no live records are modified. Actual
    // database authority for both categories is covered by the SQL rehearsal.
    if (storedRole === "admin") {
      await page.route("**/rest/v1/profiles*", async (route) => {
        try {
        const response = await route.fetch();
        if (!response.ok()) return route.fulfill({ response });
        const body = await response.json();
        const canonical = (profile: any) => profile?.role === "super_admin" ? { ...profile, role: "admin" } : profile;
        await route.fulfill({ response, json: Array.isArray(body) ? body.map(canonical) : canonical(body) });
        } catch (error) {
          if (!/already handled|Target.*closed|Request context disposed/.test(String(error))) throw new Error("Profile response fixture failed.");
        }
      });
    }
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const quickLogin = page.getByRole("button", { name: "Choose a development account" });
    test.skip(!(await quickLogin.isVisible()), "Development account shortcuts are unavailable.");
    await quickLogin.click();
    await page.getByRole("menuitem", { name: /^Admin —/ }).click();
    const sidebar = page.locator(".eflow-productivity-sidebar").first();
    await expect(sidebar).toBeVisible({ timeout: 20_000 });
    const dismissTour = page.getByRole("button", { name: "Maybe later" });
    await dismissTour.waitFor({ timeout: 3000 }).then(() => dismissTour.click()).catch(() => {});
    await sidebar.hover();
    await sidebar.getByRole("button", { name: "User Management", exact: true }).click();
    await sidebar.getByRole("button", { name: "Role Defaults", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Role Defaults", exact: true })).toBeVisible();
    const rootCapabilities = page.getByRole("button", { name: "Admin: Allowed", exact: true });
    await expect(rootCapabilities.first()).toBeVisible();
    expect(await rootCapabilities.count()).toBeGreaterThan(10);
    for (const capability of await rootCapabilities.all()) await expect(capability).toBeDisabled();
    await expect(page.getByRole("columnheader", { name: "Super Admin", exact: true })).toHaveCount(0);
    await sidebar.hover();
    await sidebar.getByRole("button", { name: "User Access", exact: true }).click();
    await expect(page.getByRole("heading", { name: "User Access", exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Search users…")).toBeVisible();
    await sidebar.hover();
    await sidebar.getByRole("button", { name: "All Users", exact: true }).click();
    await expect(page.getByRole("heading", { name: "User Management", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Create user" }).click();
    const dialog = page.getByRole("dialog", { name: "Create New User" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("option", { name: "Admin", exact: true })).toHaveCount(1);
    await expect(dialog.getByRole("option", { name: "Head", exact: true })).toHaveCount(1);
    await expect(dialog.getByRole("option", { name: "Super Admin", exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close dialog" }).click();
  });
}
