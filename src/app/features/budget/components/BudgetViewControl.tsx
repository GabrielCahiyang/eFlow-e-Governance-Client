import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { budgetViewGroups, type BudgetView } from '../budgetViews';
import '../budgetViewControl.css';

export function BudgetViewControl({ value, onChange }: { value: BudgetView; onChange: (view: BudgetView) => void }) {
  return <div className="eflow-budget-view-control">
    <span id="budget-view-label">Budget view</span>
    <Select value={value} onValueChange={next => { if (budgetViewGroups.some(group => group.views.some(view => view.id === next))) onChange(next as BudgetView); }}>
      <SelectTrigger aria-label="Budget view" aria-describedby="budget-view-label"><SelectValue /></SelectTrigger>
      <SelectContent className="eflow-budget-view-options">{budgetViewGroups.map(group => <SelectGroup key={group.label}>
        <SelectLabel>{group.label}</SelectLabel>
        {group.views.map(view => <SelectItem className="min-h-[44px]" key={view.id} value={view.id}>{view.label}</SelectItem>)}
      </SelectGroup>)}</SelectContent>
    </Select>
  </div>;
}
