import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const api = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), upload: vi.fn(), remove: vi.fn(),
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    rpc: api.rpc, from: api.from,
    storage: { from: () => ({ upload: api.upload, remove: api.remove }) },
  },
}));
import { fetchDepartmentBudgetBundle, submitPettyCashLiquidation } from "../../src/app/features/budget/services/budgetService";

let tables: Record<string, Row[]>;
let itemized: boolean;
let sourceError: { table: string; message: string; afterFirstPage?: boolean } | undefined;
let pages: Array<{ table: string; ids: number; from: number }>;
beforeEach(() => {
  vi.resetAllMocks();
  pages = [];
  sourceError = undefined;
  itemized = true;
  tables = {
    budget_commitments: [{ id: "commitment", fiscal_budget_id: "budget" }],
    work_budget_allocations: [{ id: "allocation", commitment_id: "commitment", task_id: "task" }],
    work_budget_allocation_lines: [{ id: "source", allocation_id: "allocation", category: "Supplies", position: 0 }],
    petty_cash_requests: Array.from({ length: 205 }, (_, i) => ({ id: `request-${i}`, fiscal_budget_id: "budget", allocation_id: "allocation", pcv_number: i + 1, pcv_date: "2026-10-09" })),
    petty_cash_request_lines: Array.from({ length: 205 }, (_, i) => ({ request_id: `request-${i}`, allocation_line_id: "source", amount: 21 })),
    petty_cash_liquidations: Array.from({ length: 205 }, (_, i) => ({ id: `liquidation-${i}`, request_id: `request-${i}`, version: 1 })),
    petty_cash_receipts: Array.from({ length: 205 }, (_, i) => ({ id: `receipt-${i}`, liquidation_id: `liquidation-${i}` })),
    petty_cash_receipt_items: Array.from({ length: 1_230 }, (_, i) => ({ id: `item-${i}`, receipt_id: `receipt-${Math.floor(i / 6)}`, allocation_line_id: "source", position: i % 6, quantity: 3, unit: "pcs", particular: `Purchase ${i}`, purpose: "Workshop", amount: 3.5, account_name: "Supplies", account_label: "Printed label" })),
  };
  api.rpc.mockImplementation(async (name: string) => {
    if (name === "department_budget_summary") return { data: { id: "budget", orgId: "office", fiscalYear: 2026 }, error: null };
    if (name === "get_office_budget_sections") return itemized
      ? { data: { sections: [{ id: "section", name: "Supplies", journalAccountCode: "EXP", amount: 10000, heldAmount: 0, position: 0 }], version: 4 }, error: null }
      : { data: null, error: { code: "PGRST202", message: "Function not found" } };
    throw new Error(`Unexpected RPC ${name}`);
  });
  api.from.mockImplementation((table: string) => {
    let ids: string[] = [], filterColumn = "", scope: [string, unknown] | undefined;
    const query = {
      select: (_columns: string, options: unknown) => { expect(options).toEqual({ count: "exact" }); return query; },
      eq: (column: string, value: unknown) => { scope = [column, value]; return query; },
      in: (column: string, values: string[]) => { filterColumn = column; ids = values; return query; },
      order: (column: string) => {
        // The funding-line table has a composite key, never an id column.
        if (table === "petty_cash_request_lines") expect(["request_id", "allocation_line_id"]).toContain(column);
        return query;
      },
      range: async (from: number) => {
        pages.push({ table, ids: ids.length, from });
        if (sourceError?.table === table && (!sourceError.afterFirstPage || from > 0)) return { data: null, error: { message: sourceError.message }, count: null };
        const rows = (tables[table] || []).filter(row => (!ids.length || ids.includes(String(row[filterColumn]))) && (!scope || row[scope[0]] === scope[1]));
        return { data: rows.slice(from, from + 17), error: null, count: rows.length };
      },
    };
    return query;
  });
});

describe("merged financial bundle", () => {
  it("retains complete multi-source vouchers and itemized receipts under small Data API page limits", async () => {
    const bundle = await fetchDepartmentBudgetBundle("office", 2026);
    expect(bundle).toMatchObject({ sectionsVersion: 4, itemizedCashAvailable: true });
    expect(bundle.requests).toHaveLength(205);
    expect(bundle.requests.every(row => row.fundingLines?.length === 1)).toBe(true);
    expect(bundle.requests.find(row => row.id === "request-204")).toMatchObject({ pcvNumber: 205, pcvDate: "2026-10-09", fundingLines: [{ allocationLineId: "source", amount: 21, sourceName: "Supplies" }] });
    expect(bundle.liquidations).toHaveLength(205);
    expect(bundle.liquidations.flatMap(row => row.receipts.flatMap(receipt => receipt.items || []))).toHaveLength(1230);
    expect(bundle.liquidations.find(row => row.id === "liquidation-204")?.receipts[0].items?.[5]).toMatchObject({ id: "item-1229", quantity: 3, amount: 3.5, accountName: "Supplies", accountLabel: "Printed label" });
    for (const table of ["petty_cash_request_lines", "petty_cash_receipt_items"]) {
      const reads = pages.filter(page => page.table === table);
      expect(Math.max(...reads.map(page => page.ids))).toBe(100);
      expect(reads.some(page => page.from > 0)).toBe(true);
      expect(reads.some(page => page.ids === 5)).toBe(true);
    }
  });
  it("rejects a later item page failure instead of exporting partial facts", async () => {
    sourceError = { table: "petty_cash_receipt_items", message: "Item evidence denied", afterFirstPage: true };
    await expect(fetchDepartmentBudgetBundle("office", 2026)).rejects.toThrow("Item evidence denied");
  });
  it("rejects a missing advertised itemized source instead of labelling vouchers empty", async () => {
    sourceError = { table: "petty_cash_request_lines", message: "could not find the table in schema cache" };
    await expect(fetchDepartmentBudgetBundle("office", 2026)).rejects.toThrow("could not find the table");
  });
  it("keeps legacy cash readable when itemized capability and tables are absent", async () => {
    itemized = false;
    sourceError = { table: "petty_cash_request_lines", message: "could not find the table in schema cache" };
    const bundle = await fetchDepartmentBudgetBundle("office", 2026);
    expect(bundle.itemizedCashAvailable).toBe(false);
    expect(bundle.requests).toHaveLength(205);
    expect(bundle.requests[0].fundingLines).toEqual([]);
  });
  it("keeps stable uploaded files and avoids legacy fallback if the itemized RPC is unavailable", async () => {
    api.upload.mockResolvedValue({ error: null });
    api.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Missing function" } });
    await expect(submitPettyCashLiquidation({
      orgId: "office", requestId: "request", spent: 3.5, note: "Workshop", idempotencyKey: "command",
      receipts: [{ id: "receipt", vendor: "Store", receiptNumber: "R1", receiptDate: "2026-10-09", description: "", amount: 3.5, file: new File(["receipt"], "receipt.pdf"), items: [{ id: "item", allocationLineId: "source", quantity: 3, unit: "pcs", particular: "Pens", purpose: "Workshop", amount: 3.5 }] }],
    })).rejects.toThrow("itemized liquidation function is unavailable");
    expect(api.rpc).toHaveBeenCalledTimes(1);
    expect(api.rpc.mock.calls[0][0]).toBe("submit_itemized_cash_liquidation");
    expect(api.upload.mock.calls[0][0]).toBe("office/request/command-0-receipt.pdf");
    expect(api.remove).not.toHaveBeenCalled();
  });
});
