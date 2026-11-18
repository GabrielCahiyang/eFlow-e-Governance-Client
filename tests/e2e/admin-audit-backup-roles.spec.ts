import { expect, test } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

test.skip(process.env.EFLOW_E2E !== "1", "Opt-in local synthetic browser suite");

test("Admin Center removes Project Guests, shows OJT account type, paginates Account Audit cleanly, and prevents Backup table/filter layout bugs", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  const fixture = await projectWorkspaceFixture(page, "admin", false, {
    landingOnly: true,
  });

  await page.route("**/rest/v1/custom_roles*", (route) =>
    route.fulfill({
      json: [
        {
          key: "ojt",
          label: "OJT",
          description: "On the job training",
          base_role: "member",
          created_at: "2026-11-18T05:38:46Z",
          updated_at: "2026-11-18T18:11:39Z",
        },
      ],
    }),
  );

  await page.route("**/rest/v1/role_permissions*", (route) =>
    route.fulfill({
      json: [
        { role: "ojt", permission: "navigation.projects", allowed: true },
        { role: "ojt", permission: "navigation.tasks", allowed: true },
        { role: "ojt", permission: "navigation.reviews", allowed: true },
      ],
    }),
  );

  const auditRows = Array.from({ length: 30 }, (_, idx) => ({
    id: `audit-${idx + 1}`,
    actor_id: fixture.id,
    actor_name: idx === 0 ? "Super Admin" : `Reviewer ${String(idx + 1).padStart(2, "0")}`,
    entity_type: idx === 0 ? "role_permissions" : "account",
    entity_id: idx === 0 ? "head:announcements.publish" : fixture.id,
    action: idx === 0 ? "access.role_permissions.update" : "onboarding_dismissed",
    reason: null,
    before_data:
      idx === 0
        ? {
            role: "head",
            permission: "announcements.publish",
            allowed: true,
            updated_at: "2026-11-18T18:42:40Z",
          }
        : null,
    after_data:
      idx === 0
        ? {
            role: "head",
            permission: "announcements.publish",
            allowed: false,
            updated_at: "2026-11-18T18:42:42Z",
          }
        : { officeId: null, resourceId: fixture.id },
    metadata: null,
    org_id: null,
    created_at: new Date(Date.UTC(2026, 10, 18, 18, 42 - idx, 0)).toISOString(),
  }));

  await page.route("**/rest/v1/audit_events*", (route) =>
    route.fulfill({
      json: auditRows,
      headers: {
        "content-range": `0-${auditRows.length - 1}/${auditRows.length}`,
        "access-control-expose-headers": "content-range",
      },
    }),
  );

  await page.route(/\/controlpanelEflow\/(?:api\/)?admin\/backups(?:\/|$|\?)/, async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (pathname.endsWith("/admin/backups")) {
      return route.fulfill({
        json: {
          preflight: {
            configured: true,
            database_url_configured: true,
            pg_dump_available: true,
            encryption_available: true,
            retention_hours: 24,
            tables: ["subtasks", "projects"],
            table_count: 2,
            important_tables: ["subtasks", "projects"],
            important_table_count: 2,
            domains: [{ id: "projects_work", label: "Projects & Work", description: "Work" }],
            safe_excluded_data_tables: [],
          },
          jobs: [],
        },
      });
    }
    if (pathname.includes("/rows")) {
      return route.fulfill({
        json: {
          name: "subtasks",
          domain: "projects_work",
          domain_label: "Projects & Work",
          important: true,
          sensitive: false,
          columns: [
            { name: "id", type: "string", format: "uuid", is_date: false, is_text: false, is_uuid: true, is_bool: false, is_numeric: false, searchable: false, filterable: true, sortable: true, redacted: false },
            { name: "title", type: "string", format: "text", is_date: false, is_text: true, is_uuid: false, is_bool: false, is_numeric: false, searchable: true, filterable: true, sortable: true, redacted: false },
            { name: "created_at", type: "string", format: "timestamptz", is_date: true, is_text: false, is_uuid: false, is_bool: false, is_numeric: false, searchable: false, filterable: true, sortable: true, redacted: false },
            { name: "updated_at", type: "string", format: "timestamptz", is_date: true, is_text: false, is_uuid: false, is_bool: false, is_numeric: false, searchable: false, filterable: true, sortable: true, redacted: false },
            { name: "status", type: "string", format: "text", is_date: false, is_text: true, is_uuid: false, is_bool: false, is_numeric: false, searchable: true, filterable: true, sortable: true, redacted: false },
            { name: "task_id", type: "string", format: "uuid", is_date: false, is_text: false, is_uuid: true, is_bool: false, is_numeric: false, searchable: false, filterable: true, sortable: true, redacted: false },
            { name: "is_completed", type: "boolean", format: "boolean", is_date: false, is_text: false, is_uuid: false, is_bool: true, is_numeric: false, searchable: false, filterable: true, sortable: true, redacted: false },
            { name: "completed_by", type: "string", format: "uuid", is_date: false, is_text: false, is_uuid: true, is_bool: false, is_numeric: false, searchable: false, filterable: true, sortable: true, redacted: false },
          ],
          rows: [
            {
              id: "11111111-1111-1111-1111-111111111111",
              title: "Verify community outreach",
              created_at: "2026-11-18T10:08:00Z",
              updated_at: "2026-11-18T10:08:00Z",
              status: "todo",
              task_id: "a043b479-29dc-45a6-8b3c-b3144d3ae111",
              is_completed: false,
              completed_by: null,
            },
          ],
          total: 1,
          page: 1,
          page_size: 25,
          total_pages: 1,
          sort_by: "created_at",
          sort_dir: "desc",
        },
      });
    }
    return route.fulfill({ json: {} });
  });

  // 1. People & Accounts: Project Guests tab is removed.
  await page.goto("/users?page=People%20%26%20Accounts");
  await expect(page.getByRole("tab", { name: "Office Accounts" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Project Guests/i })).toHaveCount(0);

  // 2. Roles & Access: OJT displays Account type: Member without requiring Edit.
  await page.getByRole("button", { name: "Roles & Access", exact: true }).click();
  await page.getByRole("button", { name: /OJT/ }).click();
  await expect(page.getByText("Account type: Member")).toBeVisible();

  // 3. Account Audit: clean headers, no mid-word wrapping, readable role-permission text, and pagination.
  await page.getByRole("button", { name: "Account Audit", exact: true }).click();
  await expect(page.getByText("Showing 1–25 of 30 events")).toBeVisible();
  await expect(page.getByText("Role permission updated")).toBeVisible();
  await expect(page.getByText("Access allowed: Yes → No")).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize Changed by column" })).toBeVisible();

  const auditHeaderBoxes = await page
    .locator("table[aria-label='Account audit events'], [aria-label='Account audit events'] thead th")
    .evaluateAll((els) => els.filter((el) => el.tagName === "TH").map((el) => el.getBoundingClientRect().height));
  expect(Math.max(...auditHeaderBoxes)).toBeLessThanOrEqual(48);

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Showing 26–30 of 30 events")).toBeVisible();

  // 4. Backup -> Important Data Explorer: non-overlapping filter bar, single-line headers & "Rows" label, resizable column handle.
  await page.getByRole("button", { name: "Backup", exact: true }).click();
  await page.getByRole("tab", { name: "Important Data Explorer" }).click();
  await expect(page.getByText("Verify community outreach")).toBeVisible();

  const sortBox = await page.getByRole("combobox", { name: "Sort rows by column" }).boundingBox();
  const dirBox = await page.getByRole("combobox", { name: "Sort direction" }).boundingBox();
  const clearBox = await page.getByRole("button", { name: "Clear filters" }).boundingBox();
  expect(sortBox && dirBox && clearBox).toBeTruthy();
  expect(sortBox!.x + sortBox!.width).toBeLessThanOrEqual(dirBox!.x + 1);
  expect(dirBox!.x + dirBox!.width).toBeLessThanOrEqual(clearBox!.x + 1);

  const explorerThHeights = await page
    .locator("div[aria-label='subtasks table rows'] thead th, [aria-label$='table rows'] thead th")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.max(...explorerThHeights)).toBeLessThanOrEqual(46);

  const rowsLabelBox = await page.getByText("Rows", { exact: true }).boundingBox();
  expect(rowsLabelBox && rowsLabelBox.height).toBeLessThanOrEqual(24);
  await expect(page.getByRole("separator", { name: "Resize is_completed column" })).toBeVisible();
});
