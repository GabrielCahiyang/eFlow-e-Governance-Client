import { useMemo, useState } from "react";
import { Button } from "@vibe/core";
import { Download, Printer, ReceiptText, Search } from "lucide-react";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/input";
import type { DepartmentBudgetBundle } from "../types";
import { buildPettyCashVoucherRows, PCV_HEADINGS } from "../selectors/pettyCashVoucherReport";
import { downloadBudgetCsv, printBudgetTable } from "../services/budgetReportExport";
import { peso, StatusPill } from "./budgetUi";
import { DEFAULT_BUDGET_PAGE_SIZE, useBudgetPagination } from "../hooks/useBudgetPagination";
import { BudgetPagination } from "./BudgetPagination";

const AUTHORIZED_STATES = new Set([
  "approved",
  "scheduled_for_release",
  "partially_released",
  "released",
  "liquidation_submitted",
  "pending_leader_liquidation_review",
  "pending_department_settlement",
  "changes_requested",
  "overdue_liquidation",
  "settled",
]);

export function PettyCashVoucherRegister({ data }: { data: DepartmentBudgetBundle }) {
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [query, setQuery] = useState("");

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.requests
      .filter((r) => {
        const eligible =
          Boolean(r.pcvNumber) ||
          (r.pcvLegacy !== false && AUTHORIZED_STATES.has(r.status));
        if (!eligible || (verifiedOnly && r.status !== "settled")) return false;
        if (!q) return true;
        const searchable = `${r.pcvNumber || ""} ${r.requestNumber || r.id} ${
          !r.pcvNumber && r.pcvLegacy !== false ? "legacy unnumbered" : ""
        } ${r.purpose} ${r.requesterName || ""} ${r.cashRecipientName || ""}`.toLowerCase();
        return searchable.includes(q);
      })
      .sort(
        (a, b) =>
          (a.pcvNumber || Number.MAX_SAFE_INTEGER) -
          (b.pcvNumber || Number.MAX_SAFE_INTEGER),
      );
  }, [data.requests, query, verifiedOnly]);

  const exportRows = useMemo(
    () => buildPettyCashVoucherRows({ ...data, requests: filteredRequests }, verifiedOnly),
    [data, filteredRequests, verifiedOnly],
  );
  const pagination = useBudgetPagination(
    filteredRequests,
    `${data.summary?.id || ""}:${verifiedOnly}:${query}`,
    DEFAULT_BUDGET_PAGE_SIZE,
  );

  const exportTitle = `${
    verifiedOnly
      ? "Summary of Task-funded Cash Expenses"
      : "Task Cash Voucher Register · includes unverified packages"
  } · FY ${data.summary?.fiscalYear}`;

  return (
    <section
      className="overflow-hidden rounded-[10px] border border-border bg-card"
      aria-label="Task cash voucher records"
    >
      <header className="eflow-budget-section-heading border-b border-border">
        <div className="flex flex-wrap items-center gap-2.5">
          <div>
            <h2>Task Cash Vouchers</h2>
            <p>Task-funded vouchers, receipt items and settlement summary.</p>
          </div>
          <span className="rounded-[5px] border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {filteredRequests.length} {filteredRequests.length === 1 ? "voucher" : "vouchers"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            kind="secondary"
            size="small"
            onClick={() =>
              downloadBudgetCsv("petty-cash-vouchers.csv", PCV_HEADINGS, exportRows)
            }
          >
            <Download size={14} /> CSV
          </Button>
          <Button
            kind="tertiary"
            size="small"
            onClick={() => printBudgetTable(exportTitle, PCV_HEADINGS, exportRows)}
          >
            <Printer size={14} /> Print / PDF
          </Button>
        </div>
      </header>

      <div className="eflow-budget-register-filters border-t-0">
        <div className="eflow-budget-register-search relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Find voucher"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find PCV, request, purpose or recipient"
            className="pl-9"
          />
        </div>
        <label className="flex min-h-10 items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(event) => setVerifiedOnly(event.target.checked)}
          />{" "}
          Verified expenses only
        </label>
      </div>

      {filteredRequests.length ? (
        <div className="divide-y divide-border">
          {pagination.pageItems.map((request) => {
            const versions = data.liquidations.filter(
              (l) => l.requestId === request.id,
            );
            const liquidation = versions
              .filter((l) => !verifiedOnly || l.status === "approved")
              .sort((a, b) => b.version - a.version)[0];
            const reference = request.pcvNumber
              ? `PCV ${String(request.pcvNumber).padStart(2, "0")}`
              : `Legacy · FR-${String(request.requestNumber || request.id).padStart(5, "0")}`;
            const spent = liquidation?.declaredSpent ?? request.actualSpent ?? 0;
            const returned = liquidation?.returnedAmount ?? request.returnedAmount ?? 0;
            const recipient = request.cashRecipientName || request.requesterName;
            const receipts = liquidation?.receipts || [];

            return (
              <article key={request.id} className="bg-card">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-subtle px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-border bg-card px-2 py-0.5 font-mono text-[12px] font-semibold text-foreground">
                        <ReceiptText size={12} className="text-primary" aria-hidden="true" />
                        {reference}
                      </span>
                      <StatusPill status={request.status} />
                      {liquidation && (
                        <span className="rounded-[5px] border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          v{liquidation.version}
                        </span>
                      )}
                      <span className="text-[12px] text-muted-foreground">
                        {request.pcvDate || "No PCV date"}
                        {recipient ? ` · ${recipient}` : ""}
                      </span>
                    </div>
                    <div className="text-[13px] font-semibold text-foreground">
                      {request.purpose}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 text-right tabular-nums">
                    <div>
                      <div className="text-[11px] text-muted-foreground">Spent</div>
                      <div className="text-[15px] font-semibold text-foreground">
                        {peso.format(spent)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Returned cash</div>
                      <div className="text-[14px] font-medium text-muted-foreground">
                        {peso.format(returned)}
                      </div>
                    </div>
                  </div>
                </div>

                {receipts.length ? (
                  <div className="eflow-budget-table-scroll">
                    <table className="eflow-budget-record-table min-w-[780px] text-left">
                      <thead>
                        <tr>
                          <th scope="col">Store / vendor</th>
                          <th scope="col">Receipt no. &amp; date</th>
                          <th scope="col">Particulars</th>
                          <th scope="col">Expense account</th>
                          <th scope="col" className="text-right">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {receipts.flatMap((receipt) => {
                          const items = receipt.items || [];
                          if (!items.length) {
                            return [
                              <tr key={receipt.id}>
                                <td className="font-medium text-foreground">
                                  {receipt.vendor}
                                </td>
                                <td className="whitespace-nowrap text-[12px] text-muted-foreground">
                                  <div className="font-mono text-foreground">
                                    {receipt.receiptNumber || "—"}
                                  </div>
                                  <div>{receipt.receiptDate}</div>
                                </td>
                                <td>
                                  <div className="text-foreground">
                                    {receipt.description}
                                  </div>
                                </td>
                                <td className="text-[12px] text-muted-foreground">
                                  Legacy receipt · not itemized
                                </td>
                                <td className="eflow-budget-number font-semibold text-foreground">
                                  {peso.format(receipt.amount)}
                                </td>
                              </tr>,
                            ];
                          }

                          const itemRows = items.map((item, idx) => (
                            <tr key={`${receipt.id}-${item.id || idx}`}>
                              <td className="font-medium text-foreground">
                                {idx === 0 ? receipt.vendor : ""}
                              </td>
                              <td className="whitespace-nowrap text-[12px] text-muted-foreground">
                                {idx === 0 ? (
                                  <>
                                    <div className="font-mono text-foreground">
                                      {receipt.receiptNumber || "—"}
                                    </div>
                                    <div>{receipt.receiptDate}</div>
                                  </>
                                ) : (
                                  ""
                                )}
                              </td>
                              <td>
                                <div className="font-medium text-foreground">
                                  {item.particular}
                                  <span className="ml-2 font-normal text-muted-foreground">
                                    ({item.quantity} {item.unit})
                                  </span>
                                </div>
                                {item.purpose && item.purpose !== request.purpose && (
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                                    {item.purpose}
                                  </div>
                                )}
                              </td>
                              <td className="text-[12px] text-muted-foreground">
                                {item.accountName || "—"}
                                {item.accountLabel ? ` (${item.accountLabel})` : ""}
                              </td>
                              <td className="eflow-budget-number font-semibold text-foreground">
                                {peso.format(item.amount)}
                              </td>
                            </tr>
                          ));

                          if (items.length > 1) {
                            itemRows.push(
                              <tr key={`${receipt.id}-subtotal`} className="bg-subtle/60">
                                <td colSpan={4} className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Receipt subtotal ({receipt.receiptNumber || receipt.vendor})
                                </td>
                                <td className="eflow-budget-number font-semibold text-foreground">
                                  {peso.format(receipt.amount)}
                                </td>
                              </tr>,
                            );
                          }

                          return itemRows;
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-4 py-3 text-[12px] text-muted-foreground">
                    No receipts recorded on this voucher yet.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="p-6">
          <EmptyState
            illustration={query ? "search" : "budget"}
            title={
              verifiedOnly
                ? "No settled expenses in this selection."
                : "No authorized vouchers in this selection."
            }
          />
        </div>
      )}

      <BudgetPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        visibleCount={pagination.pageItems.length}
        noun="voucher"
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />

      <p className="border-t border-border bg-subtle px-4 py-3 text-xs text-muted-foreground">
        Vouchers keep their reference through corrections. Older requests without a reference appear as “Legacy”. Receipts become verified when Accounting settles them.
      </p>
    </section>
  );
}
