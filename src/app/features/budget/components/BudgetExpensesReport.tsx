import { useMemo, useState } from "react";
import { Download, Printer, ReceiptText, Search, Undo2, WalletCards } from "lucide-react";
import type { DepartmentBudgetBundle } from "../types";
import { buildBudgetExpenseReportRows } from "../selectors/budgetSelectors";
import { createReceiptSignedUrl } from "../services/budgetService";
import { Input } from "../../../components/ui/input";
import { BudgetCard, BudgetEmpty, peso } from "./budgetUi";

export function BudgetExpensesReport({ data }: { data: DepartmentBudgetBundle }) {
  const rows = useMemo(() => buildBudgetExpenseReportRows(data), [data]);
  const [search, setSearch] = useState("");
  const [proposal, setProposal] = useState("all");
  const [employee, setEmployee] = useState("all");
  const [month, setMonth] = useState("all");
  const proposals = useMemo(() => unique(rows.map((row) => row.proposal)), [rows]);
  const employees = useMemo(() => unique(rows.map((row) => row.employee)), [rows]);
  const months = useMemo(() => unique(rows.map((row) => row.monthKey)).sort().reverse(), [rows]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => (
      (proposal === "all" || row.proposal === proposal)
      && (employee === "all" || row.employee === employee)
      && (month === "all" || row.monthKey === month)
      && (!needle || [row.proposal, row.task, row.subtask, row.employee, row.purpose, ...row.categories, ...row.expenseClasses]
        .filter(Boolean).join(" ").toLowerCase().includes(needle))
    ));
  }, [employee, month, proposal, rows, search]);
  const totals = useMemo(() => ({
    actual: filtered.reduce((sum, row) => sum + row.actualAmount, 0),
    returned: filtered.reduce((sum, row) => sum + row.returnedAmount, 0),
    receipts: filtered.reduce((sum, row) => sum + row.receiptCount, 0),
  }), [filtered]);

  if (!rows.length) return <BudgetEmpty title="No verified expenses yet" description="Only Head/Assistant-approved liquidations become actual spending. Settled packages will appear here with their proposal, task, employee, category, and receipts." />;

  const exportCsv = () => {
    const header = ["Request", "Settled", "Proposal", "Task", "Subtask", "Employee", "Expense class", "Category", "Purpose", "Actual spent", "Returned", "Receipts"];
    const records = filtered.map((row) => [
      `PC-${String(row.requestNumber).padStart(5, "0")}`, new Date(row.settledAt).toLocaleString(), row.proposal,
      row.task, row.subtask || "", row.employee, row.expenseClasses.join("; "), row.categories.join("; "), row.purpose,
      row.actualAmount.toFixed(2), row.returnedAmount.toFixed(2), String(row.receiptCount),
    ]);
    const csv = [header, ...records].map((record) => record.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `eflow-expenses-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <BudgetCard label="Verified spending" value={peso.format(totals.actual)} note={`${filtered.length} settled expense package(s)`} icon={<WalletCards size={15} />} />
      <BudgetCard label="Returned cash" value={peso.format(totals.returned)} note="Restored to the funded work balance" icon={<Undo2 size={15} />} tone="good" />
      <BudgetCard label="Receipt records" value={String(totals.receipts)} note="Evidence in the current report" icon={<ReceiptText size={15} />} />
      <BudgetCard label="People accountable" value={String(new Set(filtered.map((row) => row.employee)).size)} note="Cash recipients represented" icon={<ReceiptText size={15} />} />
    </div>
    <section className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <div className="relative min-w-[220px] flex-1"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search proposal, work, employee, or category…" className="h-9 pl-9 pr-3 text-[12px]" /></div>
        <Filter value={proposal} onChange={setProposal} label="All proposals" options={proposals} />
        <Filter value={employee} onChange={setEmployee} label="All employees" options={employees} />
        <Filter value={month} onChange={setMonth} label="All months" options={months} format={formatMonth} />
        <button onClick={exportCsv} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><Download size={12} /> CSV</button>
        <button onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><Printer size={12} /> Print / PDF</button>
      </header>
      {!filtered.length ? <BudgetEmpty title="No expenses match these filters" description="Clear one or more filters to restore the permission-scoped expense register." /> : <div className="overflow-x-auto" role="region" aria-label="Expense register" tabIndex={0}><table className="w-full min-w-[1050px] border-collapse text-left text-[12px]"><thead className="bg-muted text-[11px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Expense package</th><th className="px-3 py-3 font-semibold">Proposal / work</th><th className="px-3 py-3 font-semibold">Accountability</th><th className="px-3 py-3 font-semibold">Classification</th><th className="px-3 py-3 text-right font-semibold">Actual</th><th className="px-3 py-3 text-right font-semibold">Returned</th><th className="px-4 py-3 font-semibold">Evidence</th></tr></thead><tbody>{filtered.map((row) => {
        const liquidation = data.liquidations.filter((item) => item.requestId === row.id).sort((a, b) => b.version - a.version)[0];
        return <tr key={row.id} className="border-t border-border/70 align-top transition-colors hover:bg-accent/60"><td className="px-4 py-3"><strong className="text-foreground">PC-{String(row.requestNumber).padStart(5, "0")}</strong><div className="mt-1 text-muted-foreground">{new Date(row.settledAt).toLocaleDateString()}</div></td><td className="max-w-[300px] px-3 py-3"><div className="font-medium text-foreground">{row.proposal}</div><div className="mt-1 text-muted-foreground">{row.task}{row.subtask ? ` → ${row.subtask}` : ""}</div><div className="mt-1 truncate text-muted-foreground/75">{row.purpose}</div></td><td className="px-3 py-3 text-foreground">{row.employee}</td><td className="px-3 py-3"><div>{row.expenseClasses.join(", ") || "Operational expense"}</div><div className="mt-1 text-muted-foreground/75">{row.categories.join(", ") || "Funded allocation"}</div></td><td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">{peso.format(row.actualAmount)}</td><td className="px-3 py-3 text-right text-primary tabular-nums">{peso.format(row.returnedAmount)}</td><td className="px-4 py-3">{liquidation?.receipts.length ? <div className="flex flex-wrap gap-1">{liquidation.receipts.map((receipt) => <button key={receipt.id} onClick={async () => window.open(await createReceiptSignedUrl(receipt.filePath), "_blank", "noopener,noreferrer")} className="rounded-md border border-border bg-card px-2 py-1.5 text-[11px] transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{receipt.vendor} · {peso.format(receipt.amount)}</button>)}</div> : <span className="text-muted-foreground">No receipt files</span>}</td></tr>;
      })}</tbody></table></div>}
    </section>
  </div>;
}

function Filter({ value, onChange, label, options, format = (item: string) => item }: { value: string; onChange: (value: string) => void; label: string; options: string[]; format?: (value: string) => string }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 max-w-[180px] rounded-md border border-input bg-input-background px-3 text-[12px] outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><option value="all">{label}</option>{options.map((option) => <option key={option} value={option}>{format(option)}</option>)}</select>;
}

function unique(values: string[]) { return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b)); }
function csvCell(value: string) { return `"${String(value).replace(/"/g, '""')}"`; }
function formatMonth(value: string) { return new Date(`${value}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }); }
