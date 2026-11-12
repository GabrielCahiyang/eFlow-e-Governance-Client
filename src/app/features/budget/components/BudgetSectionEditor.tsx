import { EmptyState } from '../../../components/ui/EmptyState';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { BudgetSection } from "../types";
import { addSectionChild, removeSectionTree, sectionTotal } from "../selectors/budgetSections";
import {BudgetReleaseScheduleEditor} from './BudgetReleaseScheduleEditor';
import { peso } from "./budgetUi";

const fieldClass = "h-10 w-full rounded-lg border border-border bg-card px-3 text-[12px] disabled:bg-muted";
export function BudgetSectionEditor({ sections, onChange, disabled, fiscalYear, scheduleEnabled=false }: { sections: BudgetSection[]; onChange: (sections: BudgetSection[]) => void; disabled: boolean; fiscalYear?:number;scheduleEnabled?:boolean }) {
  const patch = (id: string, update: Partial<BudgetSection>) => onChange(sections.map(s => s.id === id ? { ...s, ...update } : s));
  const move = (s: BudgetSection, direction: number) => {
    const siblings = sections.filter(x => !x.retired && x.parentId === s.parentId).sort((a, b) => a.position - b.position);
    const i = siblings.findIndex(x => x.id === s.id);
    const other = siblings[i + direction];
    if (!other) return;
    [siblings[i], siblings[i + direction]] = [other, s];
    onChange(sections.map(x => x.parentId === s.parentId && !x.retired ? { ...x, position: siblings.findIndex(y => y.id === x.id) } : x));
  };
  const renderRows = (parentId?: string, depth = 0): React.ReactNode => sections
    .filter(s => !s.retired && s.parentId === parentId).sort((a, b) => a.position - b.position)
    .map(s => {
      const children = sections.some(c => !c.retired && c.parentId === s.id);
      return <section key={s.id} className="min-w-0 py-3">
        <div className="eflow-budget-account-fields">
          <label><span className="text-[11px] text-muted-foreground">{depth ? "Subaccount name" : "Account name"}</span><input aria-label={`Account name ${s.id}`} disabled={disabled} value={s.name} onChange={e => patch(s.id, { name: e.target.value })} placeholder="Your own account name" className={fieldClass} /></label>
          <label><span className="text-[11px] text-muted-foreground">{children ? "Subtotal" : "Budget amount"}</span>{children ? <output className={`${fieldClass} flex items-center justify-end tabular-nums`}>{peso.format(sectionTotal(sections, s.id))}</output> : <MoneyInput aria-label={`Budget amount ${s.name || s.id}`} disabled={disabled} min="0" step="0.01" value={s.amount || ""} onValueChange={raw => patch(s.id, { amount: Number(raw) })} className={`${fieldClass} text-right`} />}</label>
          {scheduleEnabled?<div><span className="text-[11px] text-muted-foreground">Pending releases</span><output className={`${fieldClass} flex items-center justify-end`}>{peso.format(sectionTotal(sections,s.id,'heldAmount'))}</output></div>:<label><span className="text-[11px] text-muted-foreground">For later release</span>{children ? <output className={`${fieldClass} flex items-center justify-end`}>{peso.format(sectionTotal(sections, s.id, "heldAmount"))}</output> : <MoneyInput aria-label={`Hold ${s.name || s.id}`} disabled={disabled} min="0" max={s.amount} step="0.01" value={s.heldAmount || ""} onValueChange={raw => patch(s.id, { heldAmount: Number(raw) })} className={`${fieldClass} text-right`} />}</label>}
        </div>
        {!children && <label className="mt-3 block max-w-sm"><span className="text-xs text-muted-foreground">Expense-account code (optional)</span><input disabled={disabled} value={s.accountCode || ""} onChange={e => patch(s.id, { accountCode: e.target.value })} placeholder="For example: 5-02-03-010" className={fieldClass} /><small className="text-xs text-muted-foreground">Journal account mapping is managed separately.</small></label>}
        {!children && scheduleEnabled && <BudgetReleaseScheduleEditor account={s} year={fiscalYear} disabled={disabled} onChange={update=>patch(s.id,update)}/>}
        {!disabled && <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
          {depth < 5 && !s.releaseSchedule?.length && <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2" onClick={() => onChange(addSectionChild(sections, s.id))}><Plus size={13} /> Add breakdown</button>}
          <button type="button" aria-label={`Move ${s.name} up`} onClick={() => move(s, -1)} className="rounded-lg border p-2"><ArrowUp size={14} /></button>
          <button type="button" aria-label={`Move ${s.name} down`} onClick={() => move(s, 1)} className="rounded-lg border p-2"><ArrowDown size={14} /></button>
          <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-destructive" onClick={() => onChange(removeSectionTree(sections, s.id))}><Trash2 size={13} /> Delete {children ? "account and breakdown" : "account"}</button>
        </div>}
        {children && depth < 6 && <div className="eflow-budget-account-children">{renderRows(s.id, depth + 1)}</div>}
      </section>;
    });
  return <div>
    <p className="text-xs text-muted-foreground">An account with subaccounts uses their combined total.</p>
    <div className="eflow-budget-account-list">{renderRows()}</div>
    {!sections.some(s => !s.retired) && <EmptyState illustration="budget" size="compact" title="No accounts yet. Add your first account to build this budget."/>}
    {!disabled && <button type="button" onClick={() => onChange(addSectionChild(sections))} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-primary px-4 py-3 text-[12px] text-primary"><Plus size={15} /> Add account</button>}
  </div>;
}
