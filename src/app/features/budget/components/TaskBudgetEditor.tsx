import type { ReactNode } from "react";
import { Banknote, CircleDollarSign, Plus, Trash2 } from "lucide-react";
import { createBudgetLine, PROPOSAL_EXPENSE_CLASSES, PROPOSAL_FUND_SOURCE } from "../constants";
import { getBudgetLineAmount, groupProposalBudgetLines, normalizeTaskBudgetLines } from "../selectors/budgetSelectors";
import type { BudgetLineInput, BudgetSection, TaskBudgetDecision } from "../types";
import { peso } from "./budgetUi";

export interface TaskBudgetValue {
  decision: TaskBudgetDecision;
  noCostReason?: string;
  lines: BudgetLineInput[];
}

export function TaskBudgetEditor({
  taskKey,
  value,
  fundingSource = PROPOSAL_FUND_SOURCE,
  readOnly = false,
  partitions = [],
  onChange,
}: {
  taskKey: string;
  value: TaskBudgetValue;
  fundingSource?: string;
  readOnly?: boolean;
  partitions?: BudgetSection[];
  onChange: (value: TaskBudgetValue) => void;
}) {
  const lines = normalizeTaskBudgetLines(taskKey, value.lines || []);
  const groups = groupProposalBudgetLines(lines);
  const total = lines.reduce((sum, line) => sum + getBudgetLineAmount(line), 0);
  const updateLines = (next: BudgetLineInput[]) => onChange({ ...value, lines: normalizeTaskBudgetLines(taskKey, next) });
  const selectDecision = (decision: TaskBudgetDecision) => {
    if (decision === "funded" && lines.length === 0) {
      onChange({ decision, noCostReason: "", lines: [createBudgetLine(0, taskKey)] });
      return;
    }
    onChange({ decision, noCostReason: value.noCostReason, lines: decision === "funded" ? lines : [] });
  };
  const patchIds = (ids: Set<string>, patch: Partial<BudgetLineInput>) => updateLines(lines.map((line) => ids.has(line.id) ? {
    ...line,
    ...patch,
    fundSource: fundingSource,
  } : line));
  const removeIds = (ids: Set<string>) => updateLines(lines.filter((line) => !ids.has(line.id)));

  const status = value.decision === "missing"
    ? { label: "Decision needed", className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" }
    : value.decision === "funded"
      ? { label: `Budget assigned · ${peso.format(total)}`, className: "bg-primary/10 text-primary ring-1 ring-primary/20" }
      : { label: "No cost selected", className: "bg-primary/10 text-primary ring-1 ring-primary/20" };

  return <div className="space-y-4">
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
      <DecisionCard active={value.decision === "funded"} disabled={readOnly} title="Budget assigned" note="Add categories and particulars" onClick={() => selectDecision("funded")} />
      <DecisionCard active={value.decision === "no_cost"} disabled={readOnly} title="No cost required" note="Work uses no proposal money" onClick={() => selectDecision("no_cost")} />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-1 text-[10px]">
        <span className="font-medium text-neutral-500">Task funding status</span>
        <span className={`rounded-full px-2.5 py-1 font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>
    </div>

    {value.decision === "no_cost" && <label className="block"><span className="text-[10px] text-neutral-500">Why does this task require no funding?</span><textarea disabled={readOnly} value={value.noCostReason || ""} onChange={(event) => onChange({ ...value, noCostReason: event.target.value, lines: [] })} rows={3} className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-[11px] disabled:bg-neutral-50" placeholder="For example: completed using existing staff and equipment." /></label>}

    {value.decision === "funded" && <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2"><CircleDollarSign size={15} className="text-emerald-700" /><div><div className="text-[10px] font-medium text-emerald-900">{fundingSource}</div><div className="text-[9px] text-emerald-700">Fund source is fixed by the proposal owner.</div></div></div>
        <div className="text-right"><div className="text-[9px] uppercase tracking-wide text-emerald-700">Task total</div><div className="text-[16px] font-semibold text-emerald-950">{peso.format(total)}</div></div>
      </div>

      <div className="space-y-3">
        {groups.flatMap((expense) => expense.categories.map((category) => {
          const ids = new Set(category.particulars.map((line) => line.id));
          return <section key={`${expense.id}:${category.id}`} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <header className="grid gap-2 border-b border-neutral-100 bg-neutral-50 p-3 sm:grid-cols-[.8fr_1fr_auto]">
              <select disabled={readOnly} value={expense.expenseClass} onChange={(event) => patchIds(ids, { expenseClass: event.target.value })} className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[10px] disabled:bg-neutral-50">{PROPOSAL_EXPENSE_CLASSES.map((item) => <option key={item}>{item}</option>)}</select>
              <input disabled={readOnly} value={category.category} onChange={(event) => patchIds(ids, { category: event.target.value })} placeholder="Category, e.g. Workshop and Consultation" className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[10px] disabled:bg-neutral-50" />
              <div className="flex items-center justify-end gap-2"><span className="text-[10px] font-semibold tabular-nums">{peso.format(category.amount)}</span>{!readOnly && <button type="button" onClick={() => removeIds(ids)} className="rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${category.category}`}><Trash2 size={12} /></button>}</div>
            </header>
            <div className="divide-y divide-neutral-100">
              {category.particulars.map((line) => <div key={line.id}><ParticularRow line={line} readOnly={readOnly} onPatch={(patch) => patchIds(new Set([line.id]), patch)} onRemove={() => removeIds(new Set([line.id]))} />{partitions.length>0 && <label className="block px-3 pb-3"><span className="text-[11px] text-muted-foreground">Annual funding account</span><select disabled={readOnly} value={line.budgetPartitionId||""} onChange={e=>patchIds(new Set([line.id]),{budgetPartitionId:e.target.value})} className={inputClass}><option value="">Choose the account that authorizes this item</option>{partitions.map(s=><option key={s.id} value={s.id}>{s.name} · {peso.format(s.amount-s.heldAmount-(s.committedAmount||0))} available</option>)}</select></label>}</div>)}
            </div>
            {!readOnly && <button type="button" onClick={() => updateLines([...lines, { ...createBudgetLine(lines.length, taskKey), expenseClass: expense.expenseClass, category: category.category, fundSource: fundingSource }])} className="m-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-[9.5px] text-neutral-600 hover:border-emerald-300 hover:bg-emerald-50"><Plus size={11} /> Add particular</button>}
          </section>;
        }))}
      </div>
      {!readOnly && <button type="button" onClick={() => updateLines([...lines, { ...createBudgetLine(lines.length, taskKey), category: `Category ${groups.flatMap((item) => item.categories).length + 1}`, fundSource: fundingSource }])} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-neutral-300 px-4 py-2.5 text-[10px] text-neutral-600 hover:border-emerald-300 hover:bg-emerald-50"><Plus size={12} /> Add category</button>}
    </>}
  </div>;
}

function DecisionCard({ active, disabled, title, note, onClick }: { active: boolean; disabled: boolean; title: string; note: string; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/15" : "border-neutral-200 bg-white text-neutral-900 hover:border-primary/35 hover:bg-primary/5"}`}><div className="flex items-center gap-2"><Banknote size={13} /><span className="text-[10px] font-semibold">{title}</span></div><div className={`mt-1 text-[9px] ${active ? "text-primary/80" : "text-neutral-500"}`}>{note}</div></button>;
}

function ParticularRow({ line, readOnly, onPatch, onRemove }: { line: BudgetLineInput; readOnly: boolean; onPatch: (patch: Partial<BudgetLineInput>) => void; onRemove: () => void }) {
  const amount = getBudgetLineAmount(line);
  return <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-[minmax(120px,1fr)_68px_64px_88px_88px_30px] md:items-end">
    <Field label="Particular"><input disabled={readOnly} value={line.particular} onChange={(event) => onPatch({ particular: event.target.value })} placeholder="Exact item or service" className={inputClass} /></Field>
    <Field label="Quantity"><input disabled={readOnly} type="number" min={0} step="0.01" value={line.quantity ?? 1} onChange={(event) => onPatch({ quantity: Number(event.target.value), amount: Number(event.target.value) * Number(line.unitCost || 0) })} className={inputClass} /></Field>
    <Field label="Unit"><input disabled={readOnly} value={line.unit || "item"} onChange={(event) => onPatch({ unit: event.target.value })} className={inputClass} /></Field>
    <Field label="Unit cost"><input disabled={readOnly} type="number" min={0} step="0.01" value={line.unitCost || ""} onChange={(event) => onPatch({ unitCost: Number(event.target.value), amount: Number(line.quantity || 0) * Number(event.target.value) })} className={`${inputClass} text-right`} /></Field>
    <Field label="Amount"><div className="flex h-9 items-center justify-end rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 text-[10px] font-medium tabular-nums">{peso.format(amount)}</div></Field>
    {!readOnly && <button type="button" onClick={onRemove} className="mb-0.5 rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove particular"><Trash2 size={12} /></button>}
  </div>;
}

const inputClass = "mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-[10px] disabled:bg-neutral-50";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="text-[9px] uppercase tracking-wide text-neutral-400">{label}</span>{children}</label>; }
