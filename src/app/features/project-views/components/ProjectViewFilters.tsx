import { Search, Filter, Users, Building2, ArrowDownUp, ChevronDown, X } from 'lucide-react';
import { DateInput } from '../../../components/ui/DateInput';
import type { Organization, UserProfile } from '../../../types';
import { orderedStatusLabels, useWorkStatuses } from '../../work-status';
import { TASK_STATUS_LABELS } from '../../tasks';
import { EMPTY_PROJECT_FILTERS, type ProjectViewFilters as Filters } from '../types';
import '../projectViews.css';
import { ProjectFilterChips } from './ProjectFilterChips';
import '../filterChips.css';

export function ProjectViewFilters({ value, onChange, profiles, offices, count }: { value: Filters; onChange: (value: Filters) => void; profiles: UserProfile[]; offices: Organization[]; count: number }) {
  const {definitions}=useWorkStatuses();
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const hasFilters = Boolean(value.query || value.status || value.owner || value.office || value.dateFrom || value.dateTo);
  return <><div className="pv-filters" aria-label="Shared project filters">
    <label className="pv-search" data-active={Boolean(value.query) || undefined}><Search size={15} aria-hidden="true"/><input aria-label="Search project tasks" maxLength={120} placeholder="Search tasks" value={value.query} onChange={e => set({ query: e.target.value })}/></label>
    <label className="pv-select-field" data-active={Boolean(value.owner) || undefined}><Users size={14} aria-hidden="true"/><select aria-label="Filter owner" value={value.owner} onChange={e => set({ owner: e.target.value })}><option value="">All task owners</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.fullName || p.email}</option>)}</select><ChevronDown size={14} className="pv-select-chevron" aria-hidden="true"/></label>
    <label className="pv-select-field" data-active={Boolean(value.status) || undefined}><Filter size={14} aria-hidden="true"/><select aria-label="Filter status" value={value.status} onChange={e => set({ status: e.target.value })}><option value="">All statuses</option>{orderedStatusLabels(definitions,TASK_STATUS_LABELS).map(({id,label}) => <option key={id} value={id}>{label}</option>)}</select><ChevronDown size={14} className="pv-select-chevron" aria-hidden="true"/></label>
    <label className="pv-select-field" data-active={Boolean(value.office) || undefined}><Building2 size={14} aria-hidden="true"/><select aria-label="Filter Office" value={value.office} onChange={e => set({ office: e.target.value })}><option value="">All offices</option>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select><ChevronDown size={14} className="pv-select-chevron" aria-hidden="true"/></label>
    <label className="pv-select-field" data-active={value.sort !== 'manual' || undefined}><ArrowDownUp size={14} aria-hidden="true"/><select aria-label="Sort tasks" value={value.sort} onChange={e => set({ sort: e.target.value as Filters['sort'] })}><option value="manual">Manual order</option><option value="title">Task name</option><option value="deadline">Due date</option><option value="priority">Priority</option></select><ChevronDown size={14} className="pv-select-chevron" aria-hidden="true"/></label>
    <div className="pv-date-range">
      <label className="pv-date-field" data-active={Boolean(value.dateFrom) || undefined}><span className="pv-date-label">From</span><DateInput aria-label="Filter date from" max={value.dateTo || undefined} value={value.dateFrom || ''} onChange={e => set({ dateFrom: e.target.value })}/></label>
      <label className="pv-date-field" data-active={Boolean(value.dateTo) || undefined}><span className="pv-date-label">To</span><DateInput aria-label="Filter date to" min={value.dateFrom || undefined} value={value.dateTo || ''} onChange={e => set({ dateTo: e.target.value })}/></label>
    </div>
    <div className="pv-filter-meta">
      {hasFilters && <button type="button" className="pv-clear-btn" onClick={() => onChange({ ...EMPTY_PROJECT_FILTERS, sort: value.sort })}><X size={13} aria-hidden="true"/>Clear filters</button>}
      <span className="pv-filter-count" role="status">{count === 1 ? '1 visible task' : `${count} visible tasks`}</span>
    </div>
  </div><ProjectFilterChips value={value} onChange={onChange} profiles={profiles} offices={offices}/></>;
}
