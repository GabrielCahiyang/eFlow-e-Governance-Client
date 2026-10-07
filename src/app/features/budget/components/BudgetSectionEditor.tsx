import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { BudgetSection } from "../types";
import { addSectionChild, removeSectionTree, sectionTotal } from "../selectors/budgetSections";
import { peso } from "./budgetUi";

const fieldClass = "h-10 w-full rounded-lg border border-border bg-card px-3 text-[12px] disabled:bg-muted";
export function BudgetSectionEditor({ sections, onChange, disabled }: { sections: BudgetSection[]; onChange: (sections: BudgetSection[]) => void; disabled: boolean }) {
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
      return <section key={s.id} className="mt-3 rounded-xl border border-border p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(140px,1fr)_150px_150px]">
          <label><span className="text-[11px] text-muted-foreground">{depth ? "Subsection / expense account" : "Section name"}</span><input aria-label={`Section name ${s.id}`} disabled={disabled} value={s.name} onChange={e => patch(s.id, { name: e.target.value })} placeholder="Your own section name" className={fieldClass} /></label>
          <label><span className="text-[11px] text-muted-foreground">{children ? "Subtotal" : "Budget amount"}</span>{children ? <output className={`${fieldClass} flex items-center justify-end tabular-nums`}>{peso.format(sectionTotal(sections, s.id))}</output> : <input aria-label={`Budget amount ${s.name || s.id}`} disabled={disabled} type="number" min="0" step="0.01" value={s.amount || ""} onChange={e => patch(s.id, { amount: Number(e.target.value) })} className={`${fieldClass} text-right`} />}</label>
          <label><span className="text-[11px] text-muted-foreground">For later release</span>{children ? <output className={`${fieldClass} flex items-center justify-end`}>{peso.format(sectionTotal(sections, s.id, "heldAmount"))}</output> : <input aria-label={`Hold ${s.name || s.id}`} disabled={disabled} type="number" min="0" max={s.amount} step="0.01" value={s.heldAmount || ""} onChange={e => patch(s.id, { heldAmount: Number(e.target.value) })} className={`${fieldClass} text-right`} />}</label>
        </div>
        {!children && <label className="mt-2 block max-w-sm"><span className="text-[11px] text-muted-foreground">Expense-account code (optional label; journal mapping is separate)</span><input disabled={disabled} value={s.accountCode || ""} onChange={e => patch(s.id, { accountCode: e.target.value })} placeholder="For example: 5-02-03-010" className={fieldClass} /></label>}
        {!disabled && <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
          {depth < 5 && <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2" onClick={() => onChange(addSectionChild(sections, s.id))}><Plus size={13} /> Add breakdown</button>}
          <button type="button" aria-label={`Move ${s.name} up`} onClick={() => move(s, -1)} className="rounded-lg border p-2"><ArrowUp size={14} /></button>
          <button type="button" aria-label={`Move ${s.name} down`} onClick={() => move(s, 1)} className="rounded-lg border p-2"><ArrowDown size={14} /></button>
          <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-destructive" onClick={() => onChange(removeSectionTree(sections, s.id))}><Trash2 size={13} /> Delete {children ? "section and breakdown" : "section"}</button>
        </div>}
        {depth < 6 && renderRows(s.id, depth + 1)}
      </section>;
    });
  return <div>
    <p className="text-[12px] text-muted-foreground">Choose your own section names and amounts. If you add a breakdown, its rows make up the section total; nothing is counted twice.</p>
    {renderRows()}
    {!sections.some(s => !s.retired) && <p className="my-4 text-[12px] text-muted-foreground">No sections yet. Add your first section to build this budget.</p>}
    {!disabled && <button type="button" onClick={() => onChange(addSectionChild(sections))} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-primary px-4 py-3 text-[12px] text-primary"><Plus size={15} /> Add section</button>}
  </div>;
}
