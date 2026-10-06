import { Search, Filter, Users, Building2, ArrowDownUp } from 'lucide-react';
import type { Organization, UserProfile } from '../../../types';
import { TASK_STATUS_LABELS } from '../../tasks';
import { EMPTY_PROJECT_FILTERS, type ProjectViewFilters as Filters } from '../types';
import '../projectViews.css';
import { ProjectFilterChips } from './ProjectFilterChips';
import '../filterChips.css';

export function ProjectViewFilters({ value, onChange, profiles, offices, count }: { value: Filters; onChange: (value: Filters) => void; profiles: UserProfile[]; offices: Organization[]; count: number }) {
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  return <><div className="pv-filters" aria-label="Shared project filters">
    <label className="pv-search"><Search size={16}/><input aria-label="Search project tasks" placeholder="Search tasks" value={value.query} onChange={e => set({ query: e.target.value })}/></label>
    <label><Users size={15}/><select aria-label="Filter owner" value={value.owner} onChange={e => set({ owner: e.target.value })}><option value="">All task owners</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.fullName || p.email}</option>)}</select></label>
    <label><Filter size={15}/><select aria-label="Filter status" value={value.status} onChange={e => set({ status: e.target.value })}><option value="">All statuses</option>{Object.entries(TASK_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label><Building2 size={15}/><select aria-label="Filter Office" value={value.office} onChange={e => set({ office: e.target.value })}><option value="">All Offices</option>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
    <label><ArrowDownUp size={15}/><select aria-label="Sort tasks" value={value.sort} onChange={e => set({ sort: e.target.value as Filters['sort'] })}><option value="manual">Manual order</option><option value="title">Task name</option><option value="deadline">Due date</option><option value="priority">Priority</option></select></label>
    <label>From<input type="date" aria-label="Filter date from" max={value.dateTo || undefined} value={value.dateFrom || ''} onChange={e => set({ dateFrom: e.target.value })}/></label>
    <label>To<input type="date" aria-label="Filter date to" min={value.dateFrom || undefined} value={value.dateTo || ''} onChange={e => set({ dateTo: e.target.value })}/></label>
    {(value.query || value.status || value.owner || value.office || value.dateFrom || value.dateTo) && <button onClick={() => onChange({ ...EMPTY_PROJECT_FILTERS, sort: value.sort })}>Clear filters</button>}
    <span className="pv-filter-count" role="status">{count} visible tasks</span>
  </div><ProjectFilterChips value={value} onChange={onChange} profiles={profiles} offices={offices}/></>;
}
