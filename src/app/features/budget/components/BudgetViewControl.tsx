import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { budgetViewGroups, type BudgetView } from '../budgetViews';
import '../budgetViewControl.css';

export function BudgetViewControl({ value, onChange, grouped = false }: { value: BudgetView; onChange: (view: BudgetView) => void; grouped?: boolean }) {
  const activeGroup = budgetViewGroups.find(group => group.views.some(view => view.id === value));
  return <>
    {grouped && <nav className="eflow-budget-view-navigation" aria-label="Office Budget views">
      <div className="eflow-budget-view-groups">
        {budgetViewGroups.map(group => (
          <button type="button" key={group.label} aria-pressed={group === activeGroup}
            onClick={() => { if (group !== activeGroup) onChange(group.views[0].id); }}>
            {group.label}
          </button>
        ))}
      </div>
      {activeGroup && activeGroup.views.length > 1 && <div className="eflow-budget-view-links" aria-label={activeGroup.label} role="group">
        {activeGroup.views.map(view => (
          <button type="button" key={view.id} aria-current={value === view.id ? 'page' : undefined}
            onClick={() => { if (value !== view.id) onChange(view.id); }}>
            {view.label}
          </button>
        ))}
      </div>}
    </nav>}
    <div className={`eflow-budget-view-control${grouped ? ' eflow-budget-view-control--compact' : ''}`}>
    <Select value={value} onValueChange={next => { if (budgetViewGroups.some(group => group.views.some(view => view.id === next))) onChange(next as BudgetView); }}>
      <SelectTrigger aria-label="Budget view"><SelectValue /></SelectTrigger>
      <SelectContent className="eflow-budget-view-options">{budgetViewGroups.map(group => <SelectGroup key={group.label}>
        <SelectLabel>{group.label}</SelectLabel>
        {group.views.map(view => <SelectItem className="min-h-[44px]" key={view.id} value={view.id}>{view.label}</SelectItem>)}
      </SelectGroup>)}</SelectContent>
    </Select>
    </div>
  </>;
}
