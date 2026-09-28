import { CircleDollarSign, Plus } from "lucide-react";
import { createBudgetLine, PROPOSAL_EXPENSE_CLASSES, PROPOSAL_FUND_SOURCE } from "../constants";
import { groupProposalBudgetLines } from "../selectors/budgetSelectors";
import type { ProposalBudgetDraft } from "../types";
import { peso } from "./budgetUi";
import { ProposalBudgetSection } from "./ProposalBudgetSection";

export function ProposalBudgetEditor({
  value,
  onChange,
  readOnly = false,
  compact = false,
}: {
  value: ProposalBudgetDraft;
  onChange: (value: ProposalBudgetDraft) => void;
  readOnly?: boolean;
  compact?: boolean;
}) {
  const normalizedLines = value.lines.map((line) => ({ ...line, fundSource: PROPOSAL_FUND_SOURCE }));
  const groups = groupProposalBudgetLines(normalizedLines);
  const total = normalizedLines.reduce((sum, line) => sum + Math.max(0, Number(line.amount) || 0), 0);
  const usedExpenseClasses = new Set(groups.map((group) => group.expenseClass));
  const nextExpenseClass = PROPOSAL_EXPENSE_CLASSES.find((item) => !usedExpenseClasses.has(item));

  const updateLines = (lines: ProposalBudgetDraft["lines"]) => {
    const normalized = lines.map((line, position) => ({ ...line, fundSource: PROPOSAL_FUND_SOURCE, position }));
    onChange({
      ...value,
      lines: normalized,
      totalAmount: normalized.reduce((sum, line) => sum + Math.max(0, Number(line.amount) || 0), 0),
    });
  };

  const addExpenseClass = () => {
    if (!nextExpenseClass) return;
    const line = createBudgetLine(normalizedLines.length);
    updateLines([...normalizedLines, {
      ...line,
      expenseClass: nextExpenseClass,
      category: "New category 1",
      particular: "",
      fundSource: PROPOSAL_FUND_SOURCE,
    }]);
  };

  return (
    <section data-testid="proposal-budget-editor" className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white ${compact ? "" : "shadow-sm"}`}>
      <header className="flex flex-wrap items-start gap-4 border-b border-neutral-100 bg-gradient-to-r from-emerald-50/80 via-white to-white p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"><CircleDollarSign size={18} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-neutral-950">Proposal funding plan</h2>
          <p className="mt-1 max-w-2xl text-[10.5px] leading-relaxed text-neutral-500">Organize the proposal by expense class and category, then add every particular underneath it. Money is reserved only after the proposal is approved and published.</p>
        </div>
        <div className="flex items-end gap-3">
          <label><span className="block text-[9px] uppercase tracking-wide text-neutral-400">Fiscal year</span><input type="number" min={2000} max={2200} disabled={readOnly} value={value.fiscalYear} onChange={(event) => onChange({ ...value, fiscalYear: Number(event.target.value) })} className="mt-1 h-9 w-24 rounded-xl border border-neutral-200 bg-white px-3 text-[10.5px] disabled:bg-neutral-50" /></label>
          <div className="min-w-36 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-right text-primary"><div className="text-[8px] uppercase tracking-[0.16em] text-primary/70">Proposal total</div><div className="mt-1 text-[15px] font-semibold tabular-nums">{peso.format(total)}</div></div>
        </div>
      </header>

      <div className="space-y-4 bg-neutral-50/30 p-5">
        {groups.map((group) => (
          <ProposalBudgetSection
            key={group.id}
            section={group}
            allLines={normalizedLines}
            readOnly={readOnly}
            canRemoveSection={groups.length > 1}
            onChange={updateLines}
          />
        ))}
        {!readOnly && nextExpenseClass && (
          <button type="button" onClick={addExpenseClass} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-dashed border-neutral-300 bg-white px-4 text-[10px] font-medium text-neutral-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"><Plus size={12} /> Add expense class</button>
        )}
      </div>
    </section>
  );
}
