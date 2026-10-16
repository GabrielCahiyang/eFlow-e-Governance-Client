import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { ACCOUNTING_VIEWS, type AccountingWorkspaceView } from '../accountingNavigation';

/** Compact fallback uses the same six descriptors as Accounting navigation. */
export function AccountingDestinationControl({ value, items, onChange }: {
  value: AccountingWorkspaceView;
  items: typeof ACCOUNTING_VIEWS;
  onChange: (view: AccountingWorkspaceView) => void;
}) {
  return <div className="eflow-accounting-destination-host"><span>Accounting destination</span>
    <Select value={value} onValueChange={next => { if (items.some(item => item.id === next)) onChange(next as AccountingWorkspaceView); }}>
      <SelectTrigger aria-label="Accounting destination"><SelectValue /></SelectTrigger>
      <SelectContent>{items.map(item => <SelectItem key={item.id} value={item.id} className="min-h-[44px]">{item.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
