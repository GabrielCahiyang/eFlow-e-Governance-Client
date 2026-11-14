import { AsyncSelectCell } from './AsyncSelectCell';

export type WorkPriority = 'low' | 'medium' | 'high';
const priorities: Record<WorkPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export function PriorityCell({ value = 'medium', title, disabled, onSave }: {
  value?: WorkPriority;
  title: string;
  disabled: boolean;
  onSave: (value: WorkPriority) => Promise<void>;
}) {
  return <AsyncSelectCell className={`pt-priority pt-priority--${value}`} value={value}
    label={`Priority for ${title}`} disabled={disabled} onSave={value => onSave(value as WorkPriority)}>
    {Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
  </AsyncSelectCell>;
}
