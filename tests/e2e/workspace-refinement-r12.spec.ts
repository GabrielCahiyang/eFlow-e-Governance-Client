import { test, expect, type Page } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
test.setTimeout(60_000);
async function adminFixture(page: Page) {
  await projectWorkspaceFixture(page, "admin", false, { landingOnly: true });
  const state = {
    values: { organization_name: "Original City", app_version: "2.0" },
    writes: [] as any[],
    uncertain: false,
    rejected: false,
    readFailure: false,
    healthFailure: false,
  };
  await page.route("**/rest/v1/system_config*", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("key")?.startsWith("eq."))
      return route.fulfill({ json: { value: null } });
    return state.readFailure
      ? route.fulfill({ status: 400, json: { message: "Read unavailable" } })
      : route.fulfill({
          json: Object.entries(state.values).map(([key, value]) => ({
            key,
            value,
          })),
          headers: {
            "content-range": "0-1/2",
            "access-control-expose-headers": "content-range",
          },
        });
  });
  await page.route("**/rest/v1/rpc/r12_save_presentation_settings", (route) => {
    const body = route.request().postDataJSON();
    state.writes.push(body);
    if (state.rejected)
      return route.fulfill({
        status: 409,
        json: {
          code: "40001",
          message: "Settings changed since loading. Reload before saving.",
        },
      });
    state.values = body.p_values;
    if (state.uncertain) {
      state.uncertain = false;
      return route.abort("failed");
    }
    return route.fulfill({ json: state.values });
  });
  await page.route(
    "**/controlpanelEflow/api/admin/configuration-health",
    (route) =>
      state.healthFailure
        ? route.fulfill({ status: 503, json: { detail: "Unavailable" } })
        : route.fulfill({
            json: {
              scope:
                "Gateway configuration presence only; no email is sent and no provider verification is performed.",
              invitations: {
                state: "configured",
                senderDomain: "resend.dev",
                restrictedTestSender: true,
                providerVerification: "unknown",
                ttlHours: 168,
                hint: "Verify the sender domain in Resend and check provider delivery logs.",
              },
              notificationSmtp: {
                state: "unavailable",
                providerVerification: "unknown",
                hint: "Operator: configure notification SMTP separately.",
              },
              authSmtp: {
                state: "operator-managed",
                providerVerification: "unknown",
                hint: "Supabase Auth SMTP is configured independently.",
              },
              redirect: {
                state: "configured",
                origin: "https://app.example.test",
                hint: "Confirm the deployed path and Supabase Auth redirect allowlist.",
              },
            },
          }),
  );
  return state;
}
for (const width of [390, 1440])
  test(`R12 nine categories and truthful configuration at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 950 });
    const state = await adminFixture(page);
    await page.goto("/users?page=System%20Settings");
    await expect(
      page.getByRole("heading", { name: "System Settings", exact: true }),
    ).toBeVisible();
    const nav = page.getByRole("tablist", { name: "Administration tools" });
    await expect(nav.getByRole("tab")).toHaveCount(9);
    await expect(page.getByLabel(/Organization Name/)).toHaveValue(
      "Original City",
    );
    await expect(
      page.getByText("Session timeout", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Session Timeout (minutes)")).toHaveCount(0);
    for (const name of [
      "Workspaces & project access policy",
      "Runtime / AI health",
      "Email & integrations",
    ])
      await nav.getByRole("tab", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Application invitations (Resend)",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(/Restricted rehearsal sender/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Notification SMTP", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Supabase Auth SMTP", exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(0);
    await page.goto("/system-settings?page=Email%20%26%20Integrations");
    await expect(
      page.getByRole("heading", { name: "Email & integrations", exact: true }),
    ).toBeVisible();
    if (width === 390)
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: info.outputPath(`r12-health-${width}.png`) });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await nav
      .getByRole("tab", { name: "Backup & export", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Backup & Export", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("One-time server setup required", { exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Email & integrations", exact: true }),
    ).toBeVisible();
    state.healthFailure = true;
    await page.getByRole("button", { name: "Refresh delivery health" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Configuration health is unavailable" }),
    ).toBeVisible();
  });
test("R12 settings guard drafts, update actual branding and verify an uncertain save without a new request", async ({
  page,
}, info) => {
  const state = await adminFixture(page);
  await page.goto("/users?page=System%20Settings");
  const name = page.getByLabel(/Organization Name/);
  await expect(name).toHaveValue("Original City");
  await name.fill("Reviewed City");
  await page
    .getByRole("tab", { name: "Email & integrations", exact: true })
    .click();
  const discard = page.getByRole("alertdialog");
  await expect(discard).toBeVisible();
  await discard
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(name).toHaveValue("Reviewed City");
  state.uncertain = true;
  await page
    .getByRole("button", { name: "Save Settings", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Verify settings save", exact: true }),
  ).toBeVisible();
  await expect(name).toBeDisabled();
  await page
    .getByRole("button", { name: "Verify settings save", exact: true })
    .click();
  await expect(
    page.getByText(/Presentation settings saved and audited/),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]).toEqual(state.writes[1]);
  await expect(page.locator(".eflow-topbar__brand-org")).toContainText(
    "Reviewed City",
  );
  await page.screenshot({ path: info.outputPath("r12-settings-saved.png") });
  await name.fill("Unsaved City");
  await page
    .getByRole("tab", { name: "Email & integrations", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /Discard/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Email & integrations", exact: true }),
  ).toBeVisible();
});
test("R12 settings read and stale-edit failures remain correctable; no deployment is explicit", async ({
  page,
}) => {
  const state = await adminFixture(page);
  state.readFailure = true;
  await page.goto("/users?page=System%20Settings");
  await expect(
    page.getByRole("button", { name: "Retry settings" }),
  ).toBeVisible();
  state.readFailure = false;
  await page.getByRole("button", { name: "Retry settings" }).click();
  await expect(page.getByLabel(/Organization Name/)).toHaveValue(
    "Original City",
  );
  state.rejected = true;
  await page.getByLabel(/Organization Name/).fill("Draft");
  await page
    .getByRole("button", { name: "Save Settings", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Settings changed since loading" }),
  ).toBeVisible();
  await expect(page.getByLabel(/Organization Name/)).toBeEnabled();
  await page.getByRole("button", { name: "Reset draft" }).click();
  await page.route("**/rest/v1/rpc/r12_save_presentation_settings", (route) =>
    route.fulfill({
      status: 404,
      json: { code: "PGRST202", message: "Missing migration" },
    }),
  );
  await page.getByLabel(/Organization Name/).fill("New City");
  await page
    .getByRole("button", { name: "Save Settings", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Validated settings saving is not installed" }),
  ).toBeVisible();
});
test("R12 authorized audit count is distinct from its 500-row window and unpermissioned members cannot open Admin settings", async ({
  page,
  browser,
  baseURL,
}, info) => {
  await adminFixture(page);
  const events = Array.from({ length: 500 }, (_, id) => ({
    id: `event-${id}`,
    actor_id: "actor",
    actor_name: "Operator",
    entity_type: "system_config",
    action: "settings.presentation.updated",
    created_at: "2026-10-08T10:00:00Z",
    before_data: { token: "never-render" },
    after_data: { organization_name: "City" },
    metadata: { secret: "never-render" },
  }));
  await page.route("**/rest/v1/audit_events*", (route) =>
    route.fulfill({
      json: events,
      headers: {
        "content-range": "0-499/801",
        "access-control-expose-headers": "content-range",
      },
    }),
  );
  await page.goto("/users?page=Account%20Audit");
  await expect(
    page.getByText(/500 loaded of 801 permitted records/),
  ).toBeVisible();
  await expect(
    page.getByText(/older records are outside this window/),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("r12-audit-window.png") });
  const memberContext = await browser.newContext({ baseURL });
  try {
    const memberPage = await memberContext.newPage();
    await projectWorkspaceFixture(memberPage, "member", false, {
      landingOnly: true,
    });
    await memberPage.goto("/system-settings?page=System%20Settings");
    await expect(
      memberPage.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
    await expect(memberPage.getByLabel(/Organization Name/)).toHaveCount(0);
    await expect(
      memberPage.getByRole("button", { name: "Admin Center", exact: true }),
    ).toHaveCount(0);
  } finally {
    await memberContext.close();
  }
});
