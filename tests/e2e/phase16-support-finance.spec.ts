import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { projectWorkspaceFixture } from "./fixtures/projectWorkspace";
import { phase16FinancialFixture } from "./fixtures/phase16Financial";

test.setTimeout(45_000);
const accountingNav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Accounting views", exact: true });

test("Admin Center keeps legacy pages, account inspection and unsaved account edits", async ({
  page,
}, info) => {
  await projectWorkspaceFixture(page, "admin");
  await expect(
    page.getByRole("heading", { name: "Admin Center", exact: true, level: 1 }),
  ).toBeVisible();
  const people = page.getByRole("tab", { name: "People", exact: true });
  expect(
    await people.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).paddingLeft),
    ),
  ).toBeGreaterThanOrEqual(12);
  await page
    .getByRole("button", {
      name: "Inspect account Directory colleague 1",
      exact: true,
    })
    .click();
  const inspector = page.getByRole("dialog", {
    name: "Account: Directory colleague 1",
    exact: true,
  });
  await expect(inspector).toBeVisible();
  await inspector
    .getByRole("button", { name: "Edit account", exact: true })
    .click();
  const edit = page.getByRole("dialog", { name: /Edit User/ });
  await expect(edit).toBeVisible({ timeout: 10000 });
  await edit.getByLabel(/Full Name/).fill("Draft identity");
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();
  const discard = page.getByRole("alertdialog");
  await expect(discard).toBeVisible();
  await discard
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(edit.getByLabel(/Full Name/)).toHaveValue("Draft identity");
  await edit.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /Discard/ })
    .click();
  await page.getByRole("tab", { name: "Roles & Access", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Role Defaults", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Individual Access", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "User Access", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("admin-access.png") });
});

test("Account audit has bounded coverage, loaded filters, nested redaction and truthful unavailable reads on a phone", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await projectWorkspaceFixture(page, "admin", false, { landingOnly: true });
  let unavailable = false;
  await page.route("**/rest/v1/audit_events*", (route) =>
    unavailable
      ? route.fulfill({ status: 400, json: { message: "Read unavailable" } })
      : route.fulfill({
          json: [
            {
              id: "audit-one",
              actor_id: "actor",
              actor_name: "Alex",
              entity_type: "profile",
              entity_id: "person",
              action: "profile.updated",
              org_id: "10000000-0000-4000-8000-000000000001",
              created_at: "2026-10-06T12:00:00Z",
              before_data: { settings: { secret: "before-secret" } },
              after_data: { settings: { secret: "after-secret" } },
              metadata: {
                config: {
                  api_key: "metadata-secret",
                  ordinary: "Visible context",
                },
                pds: { address: "private-address" },
              },
            },
          ],
        }),
  );
  await page.goto("/users?page=Account%20Audit");
  await expect(
    page.getByText("Latest 500 permitted events", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect audit event audit-one", exact: true })
    .click();
  const inspector = page.getByRole("dialog", { name: /Audit event:/ });
  await expect(inspector).toBeVisible();
  await inspector.locator("summary").click();
  await expect(
    inspector.getByText("Visible context", { exact: false }),
  ).toBeVisible();
  expect(await inspector.textContent()).not.toMatch(
    /before-secret|after-secret|metadata-secret|private-address/,
  );
  const bounds = (await inspector.boundingBox())!;
  expect(bounds.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: info.outputPath("audit-phone.png") });
  await inspector
    .getByRole("button", { name: "Close audit details", exact: true })
    .click();
  unavailable = true;
  await page
    .getByRole("button", { name: "Refresh audit", exact: true })
    .click();
  await expect(page.getByText(/No events returned/)).toBeVisible();
  await expect(
    page.getByText(/empty result|failed read/, { exact: false }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Accounting retains fiscal scope, exposes settlements, records one decision and inspects its balanced journal", async ({
  page,
}, info) => {
  const { state } = await phase16FinancialFixture(page);
  await expect(accountingNav(page)).toBeVisible();
  await accountingNav(page)
    .getByRole("button", { name: "Settlements", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Accounting Settlements", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Settle & post", exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("version 2");
  await expect(confirm).toContainText("Head authorization recorded");
  await confirm
    .getByRole("button", { name: "Confirm settlement", exact: true })
    .click();
  await expect(page.getByText(/Settlement recorded/)).toBeVisible();
  expect(
    state.writes.filter(
      (write) => write.rpc === "settle_accounting_liquidation",
    ),
  ).toHaveLength(1);
  await accountingNav(page)
    .getByRole("button", { name: "Journal", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Inspect journal LIQ-2026-12-v2",
      exact: true,
    })
    .click();
  const inspector = page.getByRole("dialog", {
    name: "Journal entry LIQ-2026-12-v2",
    exact: true,
  });
  await expect(
    inspector.getByText("Full entry totals", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("settlement-journal.png") });
  await inspector.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Open fiscal year 2027", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open fiscal year 2028", exact: true }),
  ).toBeVisible();
  await accountingNav(page)
    .getByRole("button", { name: "Budget ledger", exact: true })
    .click();
  await expect(
    page.getByText("FY 2027 · Budget position", { exact: true }),
  ).toBeVisible();
  await accountingNav(page)
    .getByRole("button", { name: "Releases", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open fiscal year 2028", exact: true }),
  ).toBeVisible();
});

test("Uncertain settlement keeps its reason and requires verification before resubmission", async ({
  page,
}) => {
  const { state } = await phase16FinancialFixture(page);
  state.failSettlement = true;
  await accountingNav(page)
    .getByRole("button", { name: "Settlements", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await page
    .getByLabel("Required liquidation correction", { exact: true })
    .fill("Missing supplier receipt");
  await page
    .getByRole("button", { name: "Send correction", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Send corrections", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Verify settlement outcome",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Required liquidation correction", { exact: true }),
  ).toHaveValue("Missing supplier receipt");
  await page
    .getByRole("button", { name: "Verify settlement outcome", exact: true })
    .click();
  await expect(page.getByText(/still pending or unavailable/)).toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test("Journal correction has guarded lines, explicit posting and a retained uncertainty receipt on a phone", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { state } = await phase16FinancialFixture(page);
  state.failJournal = true;
  await accountingNav(page)
    .getByRole("button", { name: "Journal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Post adjustment", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Post correcting journal entry",
    exact: true,
  });
  await dialog.getByLabel("Reference number", { exact: true }).fill("COR-16");
  await dialog
    .getByLabel("Memo / correction reason", { exact: true })
    .fill("Correct cash classification");
  await dialog.getByLabel("Debit line 1", { exact: true }).fill("500");
  await dialog.getByLabel("Credit line 2", { exact: true }).fill("500");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Reference number", { exact: true }),
  ).toHaveValue("COR-16");
  await dialog
    .getByRole("button", { name: "Post balanced entry", exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirm posting", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Verify journal outcome", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Post balanced entry", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await dialog
    .getByRole("button", { name: "Cancel", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const box = await dialog.boundingBox();
      return Boolean(
        box &&
          box.x >= -1 &&
          box.y >= -1 &&
          box.x + box.width <= 390 + 1 &&
          box.y + box.height <= 844 + 1,
      );
    })
    .toBe(true);
  await dialog.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: info.outputPath("journal-phone.png") });
  expect(state.writes).toHaveLength(1);
});

test("Release handover uses its existing physical confirmation and blocks an uncertain repeat", async ({
  page,
}) => {
  const { state } = await phase16FinancialFixture(page);
  state.failRelease = true;
  await accountingNav(page)
    .getByRole("button", { name: "Releases", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark released", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Disbursement Voucher",
    exact: true,
  });
  await dialog.getByRole("checkbox").first().check();
  await dialog
    .getByRole("button", { name: "Confirm & Record Release", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Verify release outcome", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: "Confirm & Record Release",
      exact: true,
    }),
  ).toHaveAttribute("aria-disabled", "true");
  expect(state.writes).toHaveLength(1);
});

test("Reports retain seven lenses, filtered CSV export and the task inspector", async ({
  page,
}, info) => {
  await projectWorkspaceFixture(page, "head", false, { landingOnly: true });
  await page.goto("/reports?page=Reports");
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Authorized Office scope/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Office operations/i }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Search visible report fields…")
    .fill("Prepare community assessment");
  await expect(
    page.getByRole("region", { name: "Office report rows" }),
  ).toContainText("Prepare community assessment");
  await expect(
    page.getByRole("region", { name: "Office report rows" }),
  ).not.toContainText("Coordinate Office briefing");
  for (const title of [
    "Projects and delivery",
    "Team contributions",
    "Reviews and revisions",
    "Evidence register",
    "Attention and risk register",
    "Task lifecycle history",
  ])
    await expect(
      page.getByRole("button", { name: new RegExp("^" + title) }),
    ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv).toContain("Prepare community assessment");
  expect(csv).not.toContain("Coordinate Office briefing");
  expect(csv.split(/\r?\n/)).toHaveLength(2);
  const printWindow = page.waitForEvent("popup");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const printed = await printWindow;
  await expect(printed.locator("tbody tr")).toHaveCount(1);
  await expect(printed.locator("tbody")).toContainText(
    "Prepare community assessment",
  );
  await expect(printed.locator("body")).toContainText(
    "authorized Office scope",
  );
  await printed.close();

  await page
    .getByRole("button", { name: /^Prepare community assessment/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: /Task details:/ }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("report-task.png") });
});

test("Backup preflight stays unavailable without gateway configuration", async ({
  page,
}, info) => {
  await projectWorkspaceFixture(page, "admin", false, { landingOnly: true });
  await page.goto("/users?page=Backup%20%26%20Export");
  await expect(
    page.getByText("One-time server setup required", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Create safe backup", exact: true })
      .last(),
  ).toBeDisabled();
  await page.screenshot({ path: info.outputPath("backup-preflight.png") });
});

test("Late-package Head authorization stays separate from independent Accounting settlement", async ({
  page,
  browser,
}) => {
  const { state } = await phase16FinancialFixture(page, "head");
  state.liquidations[0].department_decided_at = "";
  await page.goto("/office-budget?page=Office%20Budget&view=approvals&fy=2026");
  await page
    .getByRole("button", { name: "Approve late liquidation", exact: true })
    .click();
  const review = page.getByRole("alertdialog");
  await expect(review).toContainText("This does not settle the advance");
  await review
    .getByRole("button", { name: "Authorize package", exact: true })
    .click();
  await expect
    .poll(
      () =>
        state.writes.filter(
          (write) => write.rpc === "decide_petty_cash_liquidation",
        ).length,
    )
    .toBe(1);
  expect(state.requests[0].status).toBe("pending_department_settlement");
  const accountingContext = await browser.newContext();
  const accountingPage = await accountingContext.newPage();
  await phase16FinancialFixture(accountingPage, "accounting_staff", state);
  await accountingNav(accountingPage)
    .getByRole("button", { name: "Settlements", exact: true })
    .click();
  await accountingPage
    .getByRole("button", { name: "Settle & post", exact: true })
    .click();
  await accountingPage
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirm settlement", exact: true })
    .click();
  await expect.poll(() => state.requests[0].status).toBe("settled");
  expect(
    state.writes.filter(
      (write) => write.rpc === "settle_accounting_liquidation",
    ),
  ).toHaveLength(1);
  await accountingContext.close();
});

test("Accounting retains ordinary Member workspaces, requires an Office and cannot settle its own cash", async ({
  page,
}) => {
  const { state, fixture } = await phase16FinancialFixture(page);
  state.requests[0].requester_id = fixture.id;
  state.requests[0].cash_recipient_id = fixture.id;
  await accountingNav(page)
    .getByRole("button", { name: "Settlements", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Settle & post", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText(/cannot settle your own/i)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.goto("/projects?page=Projects");
  await expect(
    page.getByRole("region", { name: "Project main table", exact: true }),
  ).toBeVisible();
  Object.assign(fixture.profile, { org_id: null });
  await page.goto("/accounting-overview?page=Accounting%20Overview");
  await expect(
    page.getByText("Office assignment required", { exact: true }),
  ).toBeVisible();
  await expect(accountingNav(page)).toHaveCount(0);
});

test("Backup uncertain start verifies the job list and a failed job permits an explicit new attempt", async ({
  page,
}, info) => {
  const fixture = await projectWorkspaceFixture(page, "admin", false, {
    landingOnly: true,
  });
  let starts = 0,
    verified = false;
  const now = new Date().toISOString();
  const job = {
    id: "backup-attempt-16",
    actor_id: fixture.id,
    actor_email: "workspace@example.test",
    mode: "operational",
    status: "failed",
    phase: "failed",
    progress: 0,
    created_at: now,
    error: "Synthetic archive packaging failure",
    table_count: 0,
    row_count: 0,
  };
  await page.route(
    /\/controlpanelEflow\/(?:api\/)?admin\/backups(?:\?|$)/,
    (route) => {
      if (route.request().method() === "POST") {
        starts++;
        if (starts === 1) {
          job.created_at = new Date().toISOString();
          return route.abort("failed");
        }
        return route.fulfill({
          json: {
            ...job,
            id: "backup-retry-16",
            status: "completed",
            phase: "completed",
            progress: 100,
            row_count: 20,
            archive_name: "eflow-16.zip",
            archive_sha256: "synthetic-checksum",
            completed_at: new Date().toISOString(),
            expires_at: "2099-01-01T00:00:00Z",
          },
        });
      }
      return route.fulfill({
        json: {
          jobs: verified ? [job] : [],
          preflight: {
            configured: true,
            database_url_configured: true,
            pg_dump_available: true,
            encryption_available: true,
            retention_hours: 24,
            tables: ["profiles"],
            table_count: 1,
            safe_excluded_data_tables: ["system_secrets"],
          },
        },
      });
    },
  );
  await page.goto("/users?page=Backup%20%26%20Export");
  const prepare = async () => {
    await page
      .getByPlaceholder("BACK UP EFLOW", { exact: true })
      .fill("BACK UP EFLOW");
    await page
      .getByPlaceholder("Required immediately before export", { exact: true })
      .fill("synthetic-password");
  };
  await prepare();
  await page
    .getByRole("button", { name: "Create safe backup", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Verify backup outcome", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create safe backup", exact: true }),
  ).toBeDisabled();
  expect(starts).toBe(1);
  verified = true;
  await page
    .getByRole("button", { name: "Verify backup outcome", exact: true })
    .click();
  await expect(
    page.getByText(/Matching backup job backup-attempt-16 found/),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic archive packaging failure", { exact: true }),
  ).toBeVisible();
  await prepare();
  await page
    .getByRole("button", { name: "Create safe backup", exact: true })
    .click();
  await expect(
    page.getByText(/Backup job backup-retry-16 accepted/),
  ).toBeVisible();
  expect(starts).toBe(2);
  await page.screenshot({ path: info.outputPath("backup-receipts.png") });
});
