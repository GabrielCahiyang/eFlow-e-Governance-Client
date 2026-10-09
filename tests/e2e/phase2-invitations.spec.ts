import { expect, test, type Page } from "@playwright/test";

async function signInFixture(page: Page, role: string, fresh = false) {
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
    // This Phase 2 fixture exercises legacy onboarding without R3 workspace data.
    if (table?.startsWith('r3_')) return route.fulfill({status:404,json:{code:'PGRST202',message:'R3 not installed in this legacy onboarding fixture'}});
    const single = route.request().headers().accept?.includes("vnd.pgrst.object");
    let data: unknown = [];
    if (table === "profiles") data = single ? profile : [profile];
    if (table === "organizations") data = single ? office : [office];
    if (table === "user_preferences") data = { user_id: id, theme: "light", created_at: user.created_at, updated_at: user.created_at };
    if (table === "organization_approver_ids") data = role === "head" ? [id] : [];
    await route.fulfill({ json: data, headers: { "content-range": "0-0/1" } });
  });
  let record = { user_id: id, tour_key: role + '-v1', tour_version: 1, status: fresh ? 'not_started' : 'dismissed', state: { completed_steps: ['account'] }, current_step: 'welcome' };
  await page.route(/\/controlpanelEflow\//, async route => {
    const url = route.request().url();
    let body: unknown = { success: true };
    if (url.includes('/onboarding/me')) { if (route.request().method() === 'PATCH') { const patch = route.request().postDataJSON(); record = { ...record, ...patch, state: { ...record.state, ...patch } }; } body = record; }
    if (url.endsWith('/office-team')) body = { office_name: office.name, members: [profile] };
    if (url.endsWith('/invitations')) body = route.request().method() === 'POST' ? { results: [{ email: 'teammate@example.test', invitation: { id: 'invite', email: 'teammate@example.test', account_role: 'member', status: 'pending', created_at: user.created_at, expires_at: new Date(Date.now() + 604800000).toISOString(), email_delivery_status: 'sent', send_count: 1 } }] } : { invitations: [] };
    await route.fulfill({ json: body });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill("synthetic-password");
  await page.locator("#login-submit").click();
  await expect(page.locator(".eflow-productivity-sidebar").first()).toBeVisible({ timeout: 30_000 });
  const later = page.getByRole("button", { name: "Maybe later", exact: true });
  await later.waitFor({ timeout: 3000 }).then(() => later.click()).catch(() => {});
}


test('Head invite dialog follows the split reference and supports keyboard dismissal', async ({ page }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 1440, height: 1000 });
  await signInFixture(page, 'head');
  // R2 retires the people destination from the sidebar; its authorized
  // Office onboarding page remains a compatibility entry point.
  await page.goto('/team?page=Office%20Team');
  await page.getByRole('button', { name: 'Invite Member', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: /^Now, let/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('option', { name: 'Member', exact: true })).toHaveCount(2);
  await expect(dialog.getByRole('option', { name: 'Head', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Add another person', exact: true }).click();
  await expect(dialog.getByPlaceholder('Add email here')).toHaveCount(3);
  await page.screenshot({ path: info.outputPath('invite-desktop.png') });
  await dialog.press('Escape'); await expect(dialog).not.toBeVisible();
});

test('Member welcome persists skipped status and remains available from Help', async ({ page }, info) => {
  test.setTimeout(90_000); await signInFixture(page, 'member', true);
  const dialog = page.getByRole('dialog', { name: /Welcome to eFlow/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Help and Getting Started', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Help & Getting Started' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('getting-started.png') });
});

for (const width of [1440, 390]) test(`Invited account screen at ${width}px preserves locked Office and role`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.route('**/auth/v1/**', route => route.fulfill({ status: 401, json: { message: 'No session' } }));
  await page.routeWebSocket(/\/realtime\/v1\//, () => {});
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route(/\/controlpanelEflow\//, route => route.fulfill({ json: { email: 'teammate@example.test', office_name: 'LEDIPO', account_role: 'member', expires_at: new Date(Date.now() + 604800000).toISOString(), existing_account: false } }));
  await page.goto('/accept-invite?token=' + 'a'.repeat(43));
  await expect(page.getByRole('heading', { name: /^Join LEDIPO/ })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Full name', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`accept-${width}.png`), fullPage: true });
});
