import {
  WorkspaceHeader,
  WorkspaceSkeleton,
} from "../../../components/ui/workspace";
import {
  exportCsv as exportReportCsv,
  exportPdf,
  type ReportColumn,
} from "../../../services/reportService";
import "../../../components/ui/workspace/analyticalWorkspace.css";
import { useMemo, useState } from "react";
import {
  Download,
  Printer,
  ReceiptText,
  Search,
  Undo2,
  WalletCards,
} from "lucide-react";
import type { DepartmentBudgetBundle } from "../types";
import { buildBudgetExpenseReportRows } from "../selectors/budgetSelectors";
import { createReceiptSignedUrl } from "../services/budgetService";
import { Input } from "../../../components/ui/input";
import { BudgetCard, BudgetEmpty, peso } from "./budgetUi";

export function BudgetExpensesReport({
  data,
}: {
  data: DepartmentBudgetBundle & { loading?: boolean; error?: string };
}) {
  const rows = useMemo(() => buildBudgetExpenseReportRows(data), [data]);
  const [search, setSearch] = useState("");
  const [proposal, setProposal] = useState("all");
  const [employee, setEmployee] = useState("all");
  const [month, setMonth] = useState("all");
  const proposals = useMemo(
    () => unique(rows.map((row) => row.proposal)),
    [rows],
  );
  const employees = useMemo(
    () => unique(rows.map((row) => row.employee)),
    [rows],
  );
  const months = useMemo(
    () =>
      unique(rows.map((row) => row.monthKey))
        .sort()
        .reverse(),
    [rows],
  );
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (proposal === "all" || row.proposal === proposal) &&
        (employee === "all" || row.employee === employee) &&
        (month === "all" || row.monthKey === month) &&
        (!needle ||
          [
            row.proposal,
            row.task,
            row.subtask,
            row.employee,
            row.purpose,
            ...row.categories,
            ...row.expenseClasses,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  }, [employee, month, proposal, rows, search]);
  const totals = useMemo(
    () => ({
      actual: filtered.reduce((sum, row) => sum + row.actualAmount, 0),
      returned: filtered.reduce((sum, row) => sum + row.returnedAmount, 0),
      receipts: filtered.reduce((sum, row) => sum + row.receiptCount, 0),
    }),
    [filtered],
  );

  if (data.loading) return <WorkspaceSkeleton label="Loading expense facts" />;
  if (data.error)
    return (
      <p role="alert" className="eflow-analytics-error">
        Expense facts unavailable: {data.error}. Retry the Office budget
        refresh.
      </p>
    );
  if (!rows.length)
    return (
      <BudgetEmpty
        title="No verified expenses yet"
        description="Only Head/Assistant-approved liquidations become actual spending. Settled packages will appear here with their proposal, task, member, category, and receipts."
      />
    );

  const columns: ReportColumn<(typeof filtered)[number]>[] = [
    {
      key: "request",
      header: "Request",
      value: (r) => `PC-${String(r.requestNumber).padStart(5, "0")}`,
    },
    {
      key: "settled",
      header: "Settled",
      value: (r) => new Date(r.settledAt).toLocaleString(),
    },
    { key: "proposal", header: "Proposal", value: (r) => r.proposal },
    { key: "task", header: "Task", value: (r) => r.task },
    { key: "subtask", header: "Subtask", value: (r) => r.subtask || "" },
    { key: "member", header: "Member", value: (r) => r.employee },
    {
      key: "class",
      header: "Expense class",
      value: (r) => r.expenseClasses.join("; "),
    },
    {
      key: "category",
      header: "Category",
      value: (r) => r.categories.join("; "),
    },
    { key: "purpose", header: "Purpose", value: (r) => r.purpose },
    {
      key: "actual",
      header: "Actual spent",
      value: (r) => r.actualAmount.toFixed(2),
    },
    {
      key: "returned",
      header: "Returned",
      value: (r) => r.returnedAmount.toFixed(2),
    },
    { key: "receipts", header: "Receipts", value: (r) => r.receiptCount },
  ];
  const meta = {
    title: "Office verified expense register",
    filters: {
      Scope: "Authorized Office budget",
      Proposal: proposal,
      Member: employee,
      Month: month,
      Search: search || "None",
    },
    totals: {
      "Actual spent": peso.format(totals.actual),
      Returned: peso.format(totals.returned),
      Receipts: totals.receipts,
    },
  };
  const exportCsv = () => exportReportCsv(filtered, columns, meta);

  return (
    <div className="eflow-analytics">
      <WorkspaceHeader
        title="Verified expense register"
        description="Approved liquidation packages with spending, returned cash and receipts."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BudgetCard
          label="Verified spending"
          value={peso.format(totals.actual)}
          note={`${filtered.length} settled expense package(s)`}
          icon={<WalletCards size={15} />}
        />
        <BudgetCard
          label="Returned cash"
          value={peso.format(totals.returned)}
          note="Restored to the funded work balance"
          icon={<Undo2 size={15} />}
          tone="good"
        />
        <BudgetCard
          label="Receipt records"
          value={String(totals.receipts)}
          note="Evidence in the current report"
          icon={<ReceiptText size={15} />}
        />
        <BudgetCard
          label="People accountable"
          value={String(new Set(filtered.map((row) => row.employee)).size)}
          note="Cash recipients represented"
          icon={<ReceiptText size={15} />}
        />
      </div>
      <section className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
        <header className="eflow-analytics-filters">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search proposal, work, member, or category…"
              className="h-9 pl-9 pr-3 text-[12px]"
            />
          </div>
          <Filter
            value={proposal}
            onChange={setProposal}
            label="All proposals"
            options={proposals}
          />
          <Filter
            value={employee}
            onChange={setEmployee}
            label="All members"
            options={employees}
          />
          <Filter
            value={month}
            onChange={setMonth}
            label="All months"
            options={months}
            format={formatMonth}
          />
          <button
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Download size={12} /> CSV
          </button>
          <button
            onClick={() => exportPdf(filtered, columns, meta)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Printer size={12} /> Print / PDF
          </button>
        </header>
        {!filtered.length ? (
          <BudgetEmpty
            title="No expenses match these filters"
            description="Clear one or more filters to restore the permission-scoped expense register."
          />
        ) : (
          <div
            className="eflow-analytics-table"
            role="region"
            aria-label="Expense register"
            tabIndex={0}
          >
            <table className="w-full min-w-[1050px] border-collapse text-left text-[12px]">
              <thead className="bg-muted text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Expense package</th>
                  <th className="px-3 py-3 font-semibold">Proposal / work</th>
                  <th className="px-3 py-3 font-semibold">Accountability</th>
                  <th className="px-3 py-3 font-semibold">Classification</th>
                  <th className="px-3 py-3 text-right font-semibold">Actual</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Returned
                  </th>
                  <th className="px-4 py-3 font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const liquidation = data.liquidations
                    .filter((item) => item.requestId === row.id)
                    .sort((a, b) => b.version - a.version)[0];
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-border/70 align-top transition-colors hover:bg-accent/60"
                    >
                      <td className="px-4 py-3">
                        <strong className="text-foreground">
                          PC-{String(row.requestNumber).padStart(5, "0")}
                        </strong>
                        <div className="mt-1 text-muted-foreground">
                          {new Date(row.settledAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="max-w-[300px] px-3 py-3">
                        <div className="font-medium text-foreground">
                          {row.proposal}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {row.task}
                          {row.subtask ? ` → ${row.subtask}` : ""}
                        </div>
                        <div className="mt-1 truncate text-muted-foreground/75">
                          {row.purpose}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {row.employee}
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          {row.expenseClasses.join(", ") ||
                            "Operational expense"}
                        </div>
                        <div className="mt-1 text-muted-foreground/75">
                          {row.categories.join(", ") || "Funded allocation"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                        {peso.format(row.actualAmount)}
                      </td>
                      <td className="px-3 py-3 text-right text-primary tabular-nums">
                        {peso.format(row.returnedAmount)}
                      </td>
                      <td className="px-4 py-3">
                        {liquidation?.receipts.length ? (
                          <div className="flex flex-wrap gap-1">
                            {liquidation.receipts.map((receipt) => (
                              <button
                                key={receipt.id}
                                onClick={async () =>
                                  window.open(
                                    await createReceiptSignedUrl(
                                      receipt.filePath,
                                    ),
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                                className="rounded-md border border-border bg-card px-2 py-1.5 text-[11px] transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              >
                                {receipt.vendor} · {peso.format(receipt.amount)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            No receipt files
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Filter({
  value,
  onChange,
  label,
  options,
  format = (item: string) => item,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: string[];
  format?: (value: string) => string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 max-w-[180px] rounded-md border border-input bg-input-background px-3 text-[12px] outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <option value="all">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {format(option)}
        </option>
      ))}
    </select>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}
function formatMonth(value: string) {
  return new Date(`${value}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
