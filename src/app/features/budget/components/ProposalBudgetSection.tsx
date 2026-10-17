import { MoneyInput } from '../../../components/ui/MoneyInput';
import { Plus, Trash2 } from "lucide-react";
import { createBudgetLine, PROPOSAL_EXPENSE_CLASSES, PROPOSAL_FUND_SOURCE } from "../constants";
import type { BudgetLineInput, ProposalBudgetExpenseGroup } from "../types";
import { peso } from "./budgetUi";

const fieldClass = "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[10.5px] text-neutral-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 disabled:bg-neutral-50";

export function ProposalBudgetSection({
  section,
  allLines,
  readOnly,
  canRemoveSection,
  onChange,
}: {
  section: ProposalBudgetExpenseGroup;
  allLines: BudgetLineInput[];
  readOnly: boolean;
  canRemoveSection: boolean;
  onChange: (lines: BudgetLineInput[]) => void;
}) {
  const sectionIds = new Set(section.categories.flatMap((category) => category.particulars.map((line) => line.id)));
  const updateIds = (ids: Set<string>, patch: Partial<BudgetLineInput>) => onChange(allLines.map((line) => ids.has(line.id) ? { ...line, ...patch, fundSource: PROPOSAL_FUND_SOURCE } : line));
  const removeIds = (ids: Set<string>) => onChange(allLines.filter((line) => !ids.has(line.id)));
  const expenseOptions = PROPOSAL_EXPENSE_CLASSES.includes(section.expenseClass as typeof PROPOSAL_EXPENSE_CLASSES[number])
    ? PROPOSAL_EXPENSE_CLASSES
    : [section.expenseClass, ...PROPOSAL_EXPENSE_CLASSES];

  const addCategory = () => {
    const line = createBudgetLine(allLines.length);
    onChange([...allLines, {
      ...line,
      expenseClass: section.expenseClass,
      category: `New category ${section.categories.length + 1}`,
      particular: "",
      fundSource: PROPOSAL_FUND_SOURCE,
    }]);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-end gap-3 border-b border-neutral-200 bg-neutral-100/80 px-4 py-3">
        <label className="min-w-56 flex-1">
          <span className="text-[8.5px] uppercase tracking-[0.16em] text-neutral-400">Expense class</span>
          <select aria-label="Expense class" disabled={readOnly} value={section.expenseClass} onChange={(event) => updateIds(sectionIds, { expenseClass: event.target.value })} className={`${fieldClass} mt-1 font-semibold uppercase`}>
            {expenseOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="w-48">
          <span className="text-[8.5px] uppercase tracking-[0.16em] text-neutral-400">Fund source</span>
          <select aria-label="Fund source" disabled={readOnly} value={PROPOSAL_FUND_SOURCE} onChange={(event) => updateIds(sectionIds, { fundSource: event.target.value })} className={`${fieldClass} mt-1`}>
            <option value={PROPOSAL_FUND_SOURCE}>{PROPOSAL_FUND_SOURCE}</option>
          </select>
        </label>
        <div className="min-w-36 text-right"><div className="text-[8.5px] uppercase tracking-[0.16em] text-neutral-400">Section subtotal</div><div className="mt-2 text-[13px] font-semibold tabular-nums text-neutral-950">{peso.format(section.amount)}</div></div>
        {!readOnly && <button type="button" aria-label={`Remove ${section.expenseClass} section`} disabled={!canRemoveSection} onClick={() => removeIds(sectionIds)} className="mb-0.5 rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-25"><Trash2 size={13} /></button>}
      </header>

      <div className="space-y-3 p-4">
        {section.categories.map((category, categoryIndex) => {
          const categoryIds = new Set(category.particulars.map((line) => line.id));
          return (
            <article key={category.id} className="overflow-hidden rounded-xl border border-neutral-200">
              <header className="flex flex-wrap items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-3 py-2.5">
                <label className="min-w-56 flex-1"><span className="sr-only">Category</span><input aria-label={`Category ${categoryIndex + 1}`} disabled={readOnly} maxLength={120} value={category.category} onChange={(event) => updateIds(categoryIds, { category: event.target.value })} placeholder="Category name" className={`${fieldClass} font-medium`} /></label>
                <div className="text-right"><div className="text-[8px] uppercase tracking-wide text-neutral-400">Category subtotal</div><div className="mt-1 text-[11px] font-semibold tabular-nums">{peso.format(category.amount)}</div></div>
                {!readOnly && <button type="button" aria-label={`Remove category ${categoryIndex + 1}`} disabled={allLines.length === category.particulars.length} onClick={() => removeIds(categoryIds)} className="rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-25"><Trash2 size={12} /></button>}
              </header>

              <div className="divide-y divide-neutral-100">
                <div className="hidden grid-cols-[1fr_170px_36px] gap-3 px-3 py-2 text-[8px] uppercase tracking-[0.15em] text-neutral-400 sm:grid"><span>Particulars</span><span className="text-right">Amount</span><span /></div>
                {category.particulars.map((line, particularIndex) => (
                  <div key={line.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_170px_36px] sm:items-center">
                    <label><span className="mb-1 block text-[8.5px] text-neutral-400 sm:hidden">Particular {particularIndex + 1}</span><input aria-label={`Particular ${particularIndex + 1} for ${category.category}`} disabled={readOnly} maxLength={200} value={line.particular} onChange={(event) => updateIds(new Set([line.id]), { particular: event.target.value })} placeholder="Describe the exact item or service" className={fieldClass} /></label>
                    <label className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400">₱</span><MoneyInput aria-label={`Amount for particular ${particularIndex + 1}`} disabled={readOnly} min={0.01} max={9999999999} step="0.01" value={line.amount || ""} onValueChange={raw => updateIds(new Set([line.id]), { amount: Number(raw) })} placeholder="0.00" className={`${fieldClass} pl-7 text-right tabular-nums`} /></label>
                    {!readOnly && <button type="button" aria-label={`Remove particular ${particularIndex + 1}`} disabled={allLines.length === 1} onClick={() => removeIds(new Set([line.id]))} className="justify-self-end rounded-lg p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-25"><Trash2 size={12} /></button>}
                  </div>
                ))}
              </div>

              {!readOnly && <button type="button" onClick={() => { const line = createBudgetLine(allLines.length); onChange([...allLines, { ...line, expenseClass: section.expenseClass, category: category.category, fundSource: PROPOSAL_FUND_SOURCE }]); }} className="m-3 inline-flex items-center gap-1 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-[9px] text-neutral-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"><Plus size={10} /> Add particular</button>}
            </article>
          );
        })}
        {!readOnly && <button type="button" onClick={addCategory} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-[9px] text-neutral-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"><Plus size={10} /> Add category</button>}
      </div>
    </section>
  );
}
