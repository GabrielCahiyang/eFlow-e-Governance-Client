import { useId, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { WorkspacePopover } from '../../../components/ui/workspace';
import { dateFilters, type WorkDestination } from '../types';
import type { WorkFilters as Filters } from '../workLocation';

export function WorkFilters({ filters, destination, workspaces, onChange }: {
  filters: Filters; destination: WorkDestination; workspaces: { id: string; name: string }[];
  onChange: (next: Partial<Filters>) => void;
}) {
  const [open, setOpen] = useState(false), scopeId = useId();
  const recent = destination === 'History' && filters.recent;
  const count = Number(filters.date !== 'All my work') + Number(!!filters.workspace) + Number(recent);
  const workspace = workspaces.find(item => item.id === filters.workspace)?.name || 'Unavailable workspace';
  const clear = () => onChange({ date: 'All my work', workspace: '', recent: false });
  const chip = (label: string, remove: () => void) => <button type="button" className="r10-filter-chip" aria-label={`Remove ${label} filter`} onClick={remove}><span>{label}</span><X size={14} aria-hidden="true" /></button>;
  return <>
    <div className="r10-toolbar">
      <label className="r10-search"><span className="sr-only">Search work</span><Search size={17} aria-hidden="true" />
        <input id="personal-work-search" aria-label="Search personal work" type="search" placeholder="Search your work…" value={filters.query} onChange={event => onChange({ query: event.target.value })} />
        {filters.query && <button type="button" aria-label="Clear search" onClick={() => onChange({ query: '' })}><X size={16} aria-hidden="true" /></button>}
      </label>
      <WorkspacePopover open={open} onOpenChange={setOpen} collisionPadding={16} contentClassName="r10-filter-popover"
        trigger={<Button type="button" variant="outline" aria-label={count ? `Filters, ${count} active` : 'Filters'}><SlidersHorizontal size={16} aria-hidden="true" />Filters{count > 0 && <span className="r10-filter-count">{count}</span>}</Button>}>
        <section aria-label="Work filters">
          <div className="r10-filter-heading"><h2>Work filters</h2>{count > 0 && <Button type="button" variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}</div>
          <fieldset><legend>Due date</legend><div className="r10-date-filters" role="group" aria-label="Work date filters">{dateFilters.map(date => <button type="button" key={date} aria-pressed={filters.date === date} onClick={() => onChange({ date })}>{date}</button>)}</div></fieldset>
          <label className="r10-scope" htmlFor={scopeId}>Workspace scope<select id={scopeId} aria-label="Workspace scope" value={filters.workspace} onChange={event => onChange({ workspace: event.target.value })}>
            <option value="">All accessible workspaces</option>{filters.workspace && !workspaces.some(item => item.id === filters.workspace) && <option value={filters.workspace}>Unavailable workspace</option>}
            {workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          {destination === 'History' && <label className="r10-recent"><input type="checkbox" checked={filters.recent} onChange={event => onChange({ recent: event.target.checked })} /><span>Recently completed<small>Last 7 days by last update</small></span></label>}
          <p className="r10-filter-help">Dates follow each item's workspace timezone. {destination === 'History' ? 'History includes authorized completed, cancelled and archived work. Personal completion dates are unavailable.' : 'All accessible workspaces are included by default.'}</p>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Done</Button>
        </section>
      </WorkspacePopover>
    </div>
    {count > 0 && <div className="r10-active-filters" aria-label="Active work filters">
      {filters.date !== 'All my work' && chip(filters.date, () => onChange({ date: 'All my work' }))}
      {filters.workspace && chip(workspace, () => onChange({ workspace: '' }))}
      {recent && chip('Recently completed', () => onChange({ recent: false }))}
      <Button type="button" variant="ghost" size="sm" onClick={clear}>Clear filters</Button>
    </div>}
  </>;
}
