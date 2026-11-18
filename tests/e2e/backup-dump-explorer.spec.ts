import { expect, test } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";

test.skip(process.env.EFLOW_E2E !== "1", "Opt-in local synthetic browser suite");

test("Backup page handles gateway recovery, SQL DB dump, paginated job filters, Important Data Explorer, and Table Catalog", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = await projectWorkspaceFixture(page, "admin", false, {
    landingOnly: true,
  });

  let gatewayOffline = true;
  const startedPayloads: Array<Record<string, unknown>> = [];
  const exportedRequests: string[] = [];

  const jobs = Array.from({ length: 7 }, (_, idx) => ({
    id: `job-${idx + 1}`,
    actor_id: fixture.id,
    actor_email: "workspace@example.test",
    mode: "operational",
    scope: idx === 0 ? "important" : "full",
    export_format: idx === 0 ? "sql_dump" : "archive",
    selected_tables: [],
    status: idx === 1 ? "failed" : "completed",
    phase: idx === 1 ? "Backup failed" : "Backup ready",
    progress: idx === 1 ? 0 : 100,
    created_at: `2026-11-${String(10 + idx).padStart(2, "0")}T02:00:00Z`,
    completed_at: `2026-11-${String(10 + idx).padStart(2, "0")}T02:01:00Z`,
    expires_at: "2099-01-01T00:00:00Z",
    archive_name:
      idx === 0 ? `eflow-backup-important-${idx + 1}.sql` : `eflow-backup-${idx + 1}.zip`,
    archive_size: 8192 * (idx + 1),
    archive_sha256: `sha256-${idx + 1}`,
    table_count: idx === 0 ? 5 : 12,
    row_count: idx === 0 ? 0 : 100 * (idx + 1),
    error: idx === 1 ? "Synthetic pg_dump timeout" : null,
  }));

  await page.route(/\/controlpanelEflow\/(?:api\/)?admin\/backups(?:\/|$|\?)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (gatewayOffline) {
      return route.fulfill({
        status: 503,
        json: {
          code: "gateway_offline",
          detail: "Local eFlow gateway (port 8322) is offline. Run npm run dev.",
        },
      });
    }

    if (pathname.endsWith("/admin/backups") && request.method() === "GET") {
      return route.fulfill({
        json: {
          preflight: {
            configured: true,
            database_url_configured: true,
            pg_dump_available: true,
            encryption_available: true,
            retention_hours: 24,
            tables: ["projects", "tasks", "profiles", "petty_cash_requests", "audit_events"],
            table_count: 5,
            important_tables: ["projects", "tasks", "profiles", "petty_cash_requests", "audit_events"],
            important_table_count: 5,
            domains: [
              { id: "projects_work", label: "Projects & Work", description: "Projects and tasks" },
              { id: "finance_budget", label: "Budget & Accounting", description: "Budgets and petty cash" },
            ],
            safe_excluded_data_tables: ["app_config", "system_config"],
          },
          jobs,
        },
      });
    }

    if (pathname.endsWith("/admin/backups") && request.method() === "POST") {
      const payload = request.postDataJSON() as Record<string, unknown>;
      startedPayloads.push(payload);
      const created = {
        id: "job-new-sql",
        actor_id: fixture.id,
        actor_email: "workspace@example.test",
        mode: payload.mode || "operational",
        scope: payload.scope || "important",
        export_format: payload.export_format || "sql_dump",
        selected_tables: payload.tables || [],
        status: "completed",
        phase: "SQL dump ready",
        progress: 100,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        expires_at: "2099-01-01T00:00:00Z",
        archive_name: "eflow-backup-important-new.sql",
        archive_size: 4096,
        archive_sha256: "sha256-new-sql",
        table_count: 5,
        row_count: 0,
      };
      jobs.unshift(created);
      return route.fulfill({ status: 202, json: created });
    }

    if (pathname.endsWith("/admin/backups/tables")) {
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const allTables = [
        {
          name: "projects",
          domain: "projects_work",
          domain_label: "Projects & Work",
          important: true,
          sensitive: false,
          column_count: 31,
          has_date_column: true,
          row_count: 14,
          api_readable: true,
        },
        {
          name: "petty_cash_requests",
          domain: "finance_budget",
          domain_label: "Budget & Accounting",
          important: true,
          sensitive: false,
          column_count: 41,
          has_date_column: true,
          row_count: 9,
          api_readable: true,
        },
      ];
      const filtered = search
        ? allTables.filter((t) => t.name.includes(search))
        : allTables;
      return route.fulfill({
        json: {
          items: filtered,
          total: filtered.length,
          page: 1,
          page_size: 15,
          total_pages: 1,
          domains: [
            { id: "projects_work", label: "Projects & Work", description: "Projects" },
            { id: "finance_budget", label: "Budget & Accounting", description: "Budgets" },
          ],
          important_count: 2,
          total_discovered: 2,
        },
      });
    }

    const rowsMatch = /\/admin\/backups\/tables\/([^/]+)\/rows$/.exec(pathname);
    if (rowsMatch) {
      const tableName = rowsMatch[1];
      const reqPage = Number(url.searchParams.get("page") || "1");
      const reqSearch = (url.searchParams.get("search") || "").toLowerCase();
      const allRows = [
        { id: `${tableName}-1`, title: "City Water Upgrade", status: "active", created_at: "2026-11-18T10:00:00Z" },
        { id: `${tableName}-2`, title: "Road Repair Batch", status: "completed", created_at: "2026-11-17T10:00:00Z" },
        { id: `${tableName}-3`, title: "School Clinic Wing", status: "planning", created_at: "2026-11-16T10:00:00Z" },
      ];
      const filteredRows = reqSearch
        ? allRows.filter((r) => JSON.stringify(r).toLowerCase().includes(reqSearch))
        : allRows;
      return route.fulfill({
        json: {
          name: tableName,
          domain: "projects_work",
          domain_label: "Projects & Work",
          important: true,
          sensitive: false,
          columns: [
            { name: "id", type: "string", format: "text", is_date: false, is_text: true, is_uuid: false, is_bool: false, is_numeric: false, searchable: true, filterable: true, sortable: true, redacted: false },
            { name: "title", type: "string", format: "text", is_date: false, is_text: true, is_uuid: false, is_bool: false, is_numeric: false, searchable: true, filterable: true, sortable: true, redacted: false },
            { name: "status", type: "string", format: "text", is_date: false, is_text: true, is_uuid: false, is_bool: false, is_numeric: false, searchable: true, filterable: true, sortable: true, redacted: false },
            { name: "created_at", type: "string", format: "timestamp with time zone", is_date: true, is_text: false, is_uuid: false, is_bool: false, is_numeric: false, searchable: false, filterable: true, sortable: true, redacted: false },
          ],
          rows: reqPage === 2 ? filteredRows.slice(2) : filteredRows,
          total: filteredRows.length,
          page: reqPage,
          page_size: 25,
          total_pages: 1,
          sort_by: "created_at",
          sort_dir: "desc",
        },
      });
    }

    const exportMatch = /\/admin\/backups\/tables\/([^/]+)\/export$/.exec(pathname);
    if (exportMatch) {
      exportedRequests.push(`${exportMatch[1]}:${url.searchParams.get("format")}:${url.searchParams.get("scope")}`);
      return route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="eflow-${exportMatch[1]}.csv"`,
          "X-Export-Row-Count": "3",
          "X-Export-Total-Matching": "3",
          "X-Export-Truncated": "false",
        },
        body: "id,title,status\nprojects-1,City Water Upgrade,active\n",
      });
    }

    return route.fulfill({ status: 404, json: { detail: "Not found" } });
  });

  await page.route(/\/controlpanelEflow\/(?:api\/)?auth\/login$/, (route) =>
    route.fulfill({
      json: {
        access_token: "fresh-token",
        refresh_token: "fresh-refresh",
      },
    }),
  );

  // 1. Offline gateway state shows clear recovery guidance and recovers when gateway starts.
  await page.goto("/users?page=Backup%20%26%20Export");
  await expect(
    page.getByRole("heading", { name: "Backup gateway route unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Local eFlow gateway \(port 8322\) is offline/)).toBeVisible();

  gatewayOffline = false;
  await page.getByRole("button", { name: "Check connection again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create backup", exact: true })).toBeVisible();

  // 2. Paginated job history renders and filters cleanly.
  await expect(page.getByText("Showing 1–5 of 7 backups")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Showing 6–7 of 7 backups")).toBeVisible();

  // 3. Switch to Important Data Explorer: search, inspect row, and export CSV.
  await page.getByRole("tab", { name: "Important Data Explorer" }).click();
  await expect(page.getByText("City Water Upgrade")).toBeVisible();
  await page.getByRole("button", { name: "Inspect row 1 in projects" }).click();
  await expect(page.getByRole("dialog")).toContainText("City Water Upgrade");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "CSV", exact: true }).click();
  await expect.poll(() => exportedRequests.length).toBe(1);
  expect(exportedRequests[0]).toBe("projects:csv:filtered");

  // 4. Switch to Database Tables catalog: select table and stage DB dump.
  await page.getByRole("tab", { name: /Database Tables/ }).click();
  await expect(page.getByText("petty_cash_requests")).toBeVisible();
  await page.getByRole("checkbox", { name: "Select petty_cash_requests for custom DB dump" }).check();
  await page.getByRole("button", { name: "Dump selected (1)" }).click();
  await expect(
    page.getByText(/Select important presets or individual tables \(1\)/),
  ).toBeVisible();

  // Responsive check at 390px: no horizontal document overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});
