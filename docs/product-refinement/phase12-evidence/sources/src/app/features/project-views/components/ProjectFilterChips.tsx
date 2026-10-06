import { X } from 'lucide-react';
import type { Organization, UserProfile } from '../../../types';
import { TASK_STATUS_LABELS } from '../../tasks';
import type { ProjectViewFilters } from '../types';

const SORT_LABELS = { manual: 'Manual order', title: 'Task name', deadline: 'Due date', priority: 'Priority' };
export function ProjectFilterChips({ value, onChange, profiles, offices }: { value: ProjectViewFilters; onChange: (value: ProjectViewFilters) => void; profiles: UserProfile[]; offices: Organization[] }) {
  const chips = [
    { key: 'dateFrom', value: value.dateFrom, label: 'From: ' + value.dateFrom },
    { key: 'dateTo', value: value.dateTo, label: 'To: ' + value.dateTo },
    { key: 'query', value: value.query, label: 'Search: ' + value.query },
    { key: 'owner', value: value.owner, label: 'Owner: ' + (profiles.find(profile => profile.id === value.owner)?.full_name || 'Unavailable person') },
    { key: 'status', value: value.status, label: 'Status: ' + (TASK_STATUS_LABELS[value.status as keyof typeof TASK_STATUS_LABELS] || value.status) },
    { key: 'office', value: value.office, label: 'Office: ' + (offices.find(office => office.id === value.office)?.name || 'Unavailable Office') },
  ] as const;
  return <div className="pv-filter-chips" aria-label="Active project filters">
    {chips.filter(chip => chip.value).map(chip => <button key={chip.key} type="button" aria-label={'Remove ' + chip.label} onClick={() => onChange({ ...value, [chip.key]: '' })}>{chip.label}<X size={14} aria-hidden="true"/></button>)}
    {value.sort !== 'manual' && <button type="button" aria-label="Restore manual order" onClick={() => onChange({ ...value, sort: 'manual' })}>Sort: {SORT_LABELS[value.sort]}<X size={14} aria-hidden="true"/></button>}
    {value.owner && <span>The owner filter matches the appointed task lead, not all contributors.</span>}
  </div>;
}
