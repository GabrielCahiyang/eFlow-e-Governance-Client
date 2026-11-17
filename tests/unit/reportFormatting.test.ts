import { describe, expect, it } from "vitest";
import {
  escapeCsv,
  escapeHtml,
  safeFilename,
} from "../../src/app/features/reports/services/formatting";
import { buildReportHtml } from "../../src/app/services/reportService";
import { formatPeso } from "../../src/app/shared/currency";
import { COLUMNS } from "../../src/app/features/projects/selectors/projectReportColumns";
import type { ProjectExecutionFinancialRow } from "../../src/app/features/projects/selectors/projectFinancialReportSelectors";
import { buildPettyCashVoucherRows } from "../../src/app/features/budget/selectors/pettyCashVoucherReport";
import type { DepartmentBudgetBundle } from "../../src/app/features/budget/types";

describe("report formatting", () => {
  it("escapes CSV cells without changing simple values", () => {
    expect(escapeCsv("Plain value")).toBe("Plain value");
    expect(escapeCsv('A "quoted", value')).toBe('"A ""quoted"", value"');
  });

  it("escapes report HTML and creates safe dated filenames", () => {
    expect(escapeHtml("<b>A & B</b>")).toBe("&lt;b&gt;A &amp; B&lt;/b&gt;");
    expect(safeFilename("My / Report!", "csv")).toMatch(/^my-report-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("renders the official eFlow SVG wordmark and LGU masthead in exported report HTML", () => {
    const html = buildReportHtml(
      [{ title: "Budget check" }],
      [{ key: "title", header: "Title", value: (row) => row.title }],
      { title: "Office summary", subtitle: "Head reports" },
    );
    expect(html).toContain('viewBox="0 0 328 88.6632"');
    expect(html).toContain("LGU Ormoc City");
    expect(html).not.toContain('<div class="mark">eF</div>');
  });

  it("formats monetary export columns with peso symbol and comma separators and aligns numeric cells in PDF HTML", () => {
    expect(formatPeso(50000)).toBe("₱50,000.00");
    expect(formatPeso(250000)).toBe("₱250,000.00");

    const projectRow: ProjectExecutionFinancialRow = {
      id: "task-1",
      level: "task",
      workItem: "Outreach",
      accountability: "Lead",
      status: "in_progress",
      progress: 50,
      deadline: "2026-11-20",
      schedule: "scheduled",
      budgetMode: "task",
      budgetAmount: 50000,
      reservedAmount: 15500,
      spentAmount: 10000,
      returnedAmount: 2500,
      availableAmount: 24500,
      receiptCount: 2,
      evidenceCount: 1,
    };
    const colVal = (key: string) => COLUMNS.find((c) => c.key === key)!.value(projectRow);
    expect(colVal("budget")).toBe("₱50,000.00");
    expect(colVal("reserved")).toBe("₱15,500.00");
    expect(colVal("spent")).toBe("₱10,000.00");
    expect(colVal("returned")).toBe("₱2,500.00");
    expect(colVal("available")).toBe("₱24,500.00");

    const html = buildReportHtml(
      [
        ["MOOE (5-02-532)", formatPeso(50000), "44.20%"],
        ["TOTAL", formatPeso(250000), "44.20%"],
      ],
      [
        { key: "account", header: "Account", value: (r) => r[0] },
        { key: "amount", header: "Appropriated", value: (r) => r[1] },
        { key: "pct", header: "% used", value: (r) => r[2] },
      ],
      { title: "Office Budget Utilization · FY 2026" },
    );
    expect(html).toContain('class="num">₱50,000.00</td>');
    expect(html).toContain('class="total-row"');
    expect(html).toContain('class="num">₱250,000.00</td>');

    const voucherRows = buildPettyCashVoucherRows({
      requests: [
        {
          id: "req-1",
          pcvNumber: 1,
          pcvDate: "2026-11-01",
          status: "settled",
          purpose: "Supplies",
        },
      ],
      liquidations: [
        {
          requestId: "req-1",
          version: 1,
          status: "approved",
          declaredSpent: 12500,
          returnedAmount: 1500,
          receipts: [
            {
              id: "rcp-1",
              vendor: "Store A",
              receiptDate: "2026-11-01",
              amount: 12500,
              description: "Paper",
              items: [
                {
                  quantity: 10,
                  unit: "ream",
                  particular: "Bond paper",
                  amount: 12500,
                  purpose: "Office print",
                },
              ],
            },
          ],
        },
      ],
    } as unknown as DepartmentBudgetBundle);
    expect(voucherRows[1][6]).toBe("₱12,500.00");
    expect(voucherRows[2][7]).toBe("₱12,500.00");
    expect(voucherRows[3][7]).toBe("₱12,500.00");
    expect(voucherRows[3][8]).toBe("Returned cash: ₱1,500.00");
  });
});
