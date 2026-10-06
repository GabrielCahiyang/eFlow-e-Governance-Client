import type { Page } from "@playwright/test";
import { projectWorkspaceFixture } from "./projectWorkspace";

export function phase16FinancialState() {
  const budget = "71000000-0000-4000-8000-000000000001",
    org = "10000000-0000-4000-8000-000000000001";
  const recipient = "00000000-0000-4000-8000-000000000002";
  const requests = [
    {
      id: "72000000-0000-4000-8000-000000000001",
      request_number: 12,
      fiscal_budget_id: budget,
      org_id: org,
      funding_org_id: org,
      requester_org_id: org,
      requester_id: recipient,
      cash_recipient_id: recipient,
      task_leader_id: recipient,
      task_id: "40000000-0000-4000-8000-000000000001",
      requested_amount: 10000,
      approved_amount: 10000,
      released_amount: 10000,
      status: "pending_department_settlement",
      purpose: "Community outreach materials",
      liquidation_due_at: "2026-01-01T00:00:00Z",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      actual_spent: 0,
      returned_amount: 0,
    },
  ];
  const liquidations = [
    {
      id: "73000000-0000-4000-8000-000000000001",
      request_id: requests[0].id,
      version: 2,
      declared_spent: 8500,
      returned_amount: 1500,
      note: "Receipts and returned change",
      status: "pending_department_settlement",
      submitted_by: recipient,
      submitted_at: "2026-10-05T00:00:00Z",
      department_decided_at: "2026-10-05T01:00:00Z",
      department_decided_by: "00000000-0000-4000-8000-000000000003",
      liquidation_number: "LIQ-2026-12-v2",
      refund_receipt_number: "OR-12",
    },
  ];
  const releases = [
    {
      id: "74000000-0000-4000-8000-000000000001",
      request_id: requests[0].id,
      org_id: org,
      scheduled_date: "2026-01-01",
      amount: 10000,
      status: "scheduled",
      recipient_id: recipient,
      created_at: "2026-10-01T00:00:00Z",
      voucher_number: "DV-2026-12",
    },
  ];
  const entries: Record<string, unknown>[] = [],
    lines: Record<string, unknown>[] = [];
  return {
    budget,
    org,
    recipient,
    requests,
    liquidations,
    releases,
    entries,
    lines,
    writes: [] as { rpc: string; body: Record<string, unknown> }[],
    failSettlement: false,
    failJournal: false,
    failRelease: false,
    failRead: false,
  };
}
export async function phase16FinancialFixture(
  page: Page,
  role: "head" | "accounting_staff" = "accounting_staff",
  state = phase16FinancialState(),
) {
  const fixture = await projectWorkspaceFixture(page, role, false, {
    actorId:
      role === "head" ? "00000000-0000-4000-8000-000000000003" : undefined,
    landingOnly: true,
  });
  fixture.profiles.push({
    ...fixture.profile,
    id: state.recipient,
    full_name: "Jordan Recipient",
    email: "recipient@example.test",
    role: "member",
  });
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      table = url.pathname.split("/").at(-1)!;
    const payload = req.postData() ? req.postDataJSON() : {};
    const summary = {
      id: state.budget,
      orgId: state.org,
      fiscalYear: payload.p_fiscal_year || 2026,
      status: "locked",
      approvedAmount: 50000,
      committedAmount: 10000,
      spentAmount: state.requests[0].actual_spent,
      availableAmount: 40000,
      dailyPettyCashReleaseLimit: 20000,
      perReceiptLimit: 1000,
      liquidationDueDays: 15,
      underutilizationThreshold: 80,
      dailyReleaseRemaining: 20000,
    };
    const tables: Record<string, unknown> = {
      department_budget_summary: summary,
      department_fiscal_budgets: [
        { fiscal_year: 2026, status: "locked", approved_amount: 50000 },
      ],
      department_budget_lines: [],
      budget_commitments: [],
      budget_ledger_entries: [],
      department_budget_adjustments: [],
      petty_cash_requests: state.requests,
      petty_cash_liquidations: state.liquidations,
      petty_cash_releases: state.releases,
      petty_cash_request_attachments: [],
      petty_cash_receipts: [
        {
          id: "receipt-1",
          liquidation_id: state.liquidations[0].id,
          vendor: "Office supplies",
          receipt_number: "INV-12",
          receipt_date: "2026-10-01",
          amount: 8500,
          file_name: "Receipt.pdf",
          file_path: "receipts/12.pdf",
        },
      ],
      general_journal_entries: state.entries.filter((entry) =>
        String(entry.entry_date).startsWith(
          (url.searchParams.get("entry_date") || "gte.2026").slice(4, 8),
        ),
      ),
      general_journal_lines: state.lines,
      accounting_accounts: [
        {
          code: "101",
          title: "Cash",
          classification: "asset",
          normal_balance: "debit",
        },
        {
          code: "105",
          title: "Member advances",
          classification: "asset",
          normal_balance: "debit",
        },
        {
          code: "501",
          title: "Supplies expense",
          classification: "expense",
          normal_balance: "debit",
        },
      ],
    };
    if (state.failRead && table === "department_budget_summary")
      return route.fulfill({
        status: 503,
        json: { message: "Financial read unavailable" },
      });
    if (
      [
        "settle_accounting_liquidation",
        "decide_petty_cash_liquidation",
        "post_general_journal_adjustment",
        "record_accounting_petty_cash_release",
      ].includes(table)
    ) {
      state.writes.push({ rpc: table, body: payload });
      if (
        (table === "settle_accounting_liquidation" &&
          role !== "accounting_staff") ||
        (table === "decide_petty_cash_liquidation" && role !== "head")
      )
        return route.fulfill({
          status: 403,
          json: {
            message: "Only the authorized role may record this decision",
            code: "42501",
          },
        });
      if (
        (state.failSettlement && table === "settle_accounting_liquidation") ||
        (state.failJournal && table === "post_general_journal_adjustment") ||
        (state.failRelease && table === "record_accounting_petty_cash_release")
      )
        return route.abort("failed");
      if (table === "decide_petty_cash_liquidation") {
        state.liquidations[0].department_decided_at = new Date().toISOString();
        return route.fulfill({ json: null });
      }
      if (table === "record_accounting_petty_cash_release") {
        state.releases[0].status = "released";
        return route.fulfill({ json: null });
      }
      if (table === "settle_accounting_liquidation") {
        state.liquidations[0].status = payload.p_approve
          ? "approved"
          : "changes_requested";
        if (payload.p_approve) {
          state.requests[0].status = "settled";
          state.requests[0].actual_spent = 8500;
          state.requests[0].returned_amount = 1500;
        }
      }
      const id =
        "75000000-0000-4000-8000-00000000000" + (state.entries.length + 1);
      state.entries.push({
        id,
        entry_number: state.entries.length + 1,
        fiscal_budget_id: state.budget,
        org_id: state.org,
        entry_date: payload.p_entry_date || "2026-10-06",
        reference_number: payload.p_reference_number || "LIQ-2026-12-v2",
        source_type:
          table === "post_general_journal_adjustment"
            ? "manual_adjustment"
            : "liquidation",
        memo: payload.p_memo || "Verified settlement",
        posted_by: fixture.id,
        posted_at: new Date().toISOString(),
      });
      const posting =
        table === "post_general_journal_adjustment"
          ? payload.p_lines
          : [
              { accountCode: "501", debit: 8500, credit: 0 },
              { accountCode: "101", debit: 1500, credit: 0 },
              { accountCode: "105", debit: 0, credit: 10000 },
            ];
      posting.forEach((line: Record<string, unknown>, index: number) =>
        state.lines.push({
          id: id + "-" + index,
          journal_entry_id: id,
          line_number: index + 1,
          account_code: line.accountCode,
          account_title: line.accountCode,
          debit: line.debit,
          credit: line.credit,
        }),
      );
      return route.fulfill({
        json: table === "post_general_journal_adjustment" ? id : null,
      });
    }
    if (table in tables) return route.fulfill({ json: tables[table] });
    return route.fallback();
  });
  await page.goto("/accounting-overview?page=Accounting%20Overview&fy=2026");
  return { fixture, state };
}
