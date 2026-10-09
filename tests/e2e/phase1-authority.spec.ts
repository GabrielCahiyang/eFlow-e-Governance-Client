import { expect, test, type Page } from "@playwright/test";

// Exercise the real app with synthetic accounts. Every backend request is intercepted.
// This fixture cannot authenticate to, read from, or mutate the deployed database.
async function signInFixture(page: Page, role: string) {
  const id = "00000000-0000-4000-8000-000000000001";
  const officeId = "10000000-0000-4000-8000-000000000001";
  const user = { id, aud: "authenticated", role: "authenticated", email: "phase1@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: new Date().toISOString() };
  const profile = { id, full_name: "Phase One Tester", email: user.email, role, org_id: officeId, is_active: true, employee_id: "TEST-001", skills: {}, created_at: user.created_at, updated_at: user.created_at };
  const office = { id: officeId, name: "Fixture Office", slug: "fixture_office", path: "fixture_office", org_type: "department", is_active: true, head_user_id: role === "head" ? id : null };
  const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"), Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), "synthetic"].join(".");
  await page.routeWebSocket(/\/realtime\/v1\//, () => {});
  await page.route("**/auth/v1/**", async route => {
    await route.fulfill({ json: route.request().url().includes("/token") ? { access_token: token, refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 3600, user } : user });
  });
  await page.route("**/rest/v1/**", async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    if (table?.startsWith("r3_")) return route.fulfill({ status: 404, json: { code: "PGRST202", message: "R3 is not installed in this legacy authority fixture" } });
    const single = route.request().headers().accept?.includes("vnd.pgrst.object");
    let data: unknown = [];
    if (table === "profiles") data = single ? profile : [profile];
    if (table === "organizations") data = single ? office : [office];
    if (table === "user_preferences") data = { user_id: id, theme: "light", created_at: user.created_at, updated_at: user.created_at };
    if (table === "organization_approver_ids") data = role === "head" ? [id] : [];
    await route.fulfill({ json: data, headers: { "content-range": "0-0/1" } });
  });
  await page.route(/\/controlpanelEflow\//, route => route.fulfill({ json: { success: true } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill("synthetic-password");
  await page.locator("#login-submit").click();
  await expect(page.locator(".eflow-productivity-sidebar").first()).toBeVisible({ timeout: 30_000 });
  const later = page.getByRole("button", { name: "Maybe later", exact: true });
  await later.waitFor({ timeout: 3000 }).then(() => later.click()).catch(() => {});
}

for (const role of ["admin", "head", "member", "accounting_staff"]) {
  test(`${role} has canonical navigation and an intact workspace`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signInFixture(page, role);
    const sidebar = page.locator(".eflow-productivity-sidebar").first();
    await sidebar.hover();
    await expect(sidebar.locator('[data-tour-section="leading"]')).toHaveCount(0);
    if (role === "admin") {
      await expect(sidebar.getByRole('button', {name:'Admin Center',exact:true})).toBeVisible();
      for (const section of ["dashboard", "projects", "tasks", "reviews", "team", "accounting_releases"]) {
        await expect(sidebar.locator(`[data-tour-section="${section}"]`)).toHaveCount(0);
      }
      await expect(page.getByRole("tab", { name: "Backup & export", exact: true })).toBeVisible();
      await page.getByRole("banner", { name: "Workspace utilities" }).hover();
      await page.getByRole("tab", { name: "Roles & permissions", exact: true }).click();
      await expect(page.getByRole("tab", { name: "Role Defaults", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("columnheader", { name: "Admin", exact: true })).toHaveCount(2);
      await expect(page.getByRole("columnheader", { name: "Head", exact: true })).toHaveCount(2);
      await expect(page.getByRole("columnheader", { name: "Member", exact: true })).toHaveCount(2);
      const allowed = page.getByRole("button", { name: "Admin: Allowed", exact: true });
      await expect(allowed).toHaveCount(9);
      for (const button of await allowed.all()) await expect(button).toBeDisabled();
      await page.getByRole("tab", { name: "People & onboarding", exact: true }).click();
      await page.getByRole("button", { name: "Create user", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Create New User" });
      await expect(dialog.getByRole("option", { name: "Member", exact: true })).toHaveCount(1);
      await expect(dialog.getByRole("option", { name: "Head", exact: true })).toHaveCount(1);
      await expect(dialog.getByRole("option", { name: "Assistant Head", exact: true })).toHaveCount(0);
      await dialog.getByRole("button", { name: "Close dialog" }).click();
    } else {
      await expect(sidebar.getByRole('button', {name:'Workspaces',exact:true})).toBeVisible();
      await expect(sidebar.getByRole('navigation', {name:'Global navigation'}).getByRole('button', {name:'My Work',exact:true})).toBeVisible();
      await expect(sidebar.locator('[data-tour-section="users"]')).toHaveCount(0);
      if (role === "head") {
        await expect(sidebar.getByRole('button', {name:'Inbox',exact:true})).toBeVisible();
        await expect(sidebar.locator('[data-tour-section="accounting_releases"]')).toHaveCount(0);
      } else if (role === "accounting_staff") {
        await expect(sidebar.locator('[data-tour-section="accounting_releases"]')).toBeVisible();
        await expect(sidebar.locator('[data-tour-section="accounting_journal"]')).toBeVisible();
      }
      await sidebar.getByRole('button', {name:'Workspaces',exact:true}).click();
      await expect(page.getByRole("region", { name: "Workspace content" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Projects and proposals", exact: true })).toBeVisible();
      await expect(page.getByText("Something went wrong", { exact: true })).toHaveCount(0);
    }
    await page.screenshot({ path: testInfo.outputPath(`${role}.png`), fullPage: true });
  });
}
