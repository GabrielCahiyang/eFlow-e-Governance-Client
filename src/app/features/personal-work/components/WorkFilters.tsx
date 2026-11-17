import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { useId, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { WorkspacePopover } from '../../../components/ui/workspace';
import { dateFilters, type WorkDestination } from '../types';
import type { WorkFilters as Filters } from '../workLocation';

export function WorkFilters({
  filters,
  destination,
  workspaces,
  projects = [],
  statuses = [],
  relations = [],
  onChange,
}: {
  filters: Filters;
  destination: WorkDestination;
  workspaces: { id: string; name: string }[];
  projects?: string[];
  statuses?: { value: string; label: string }[];
  relations?: string[];
  onChange: (next: Partial<Filters>) => void;
}) {
  const [open, setOpen] = useState(false),
    scopeId = useId(),
    projectId = useId(),
    statusId = useId(),
    roleId = useId();
  const recent = destination === 'History' && filters.recent;
  const popoverCount =
    Number(recent) +
    Number(!!filters.project) +
    Number(!!filters.status) +
    Number(!!filters.relation);
  const count =
    Number(filters.date !== 'All my work') +
    Number(!!filters.workspace) +
    popoverCount;
  const workspace = workspaces.find(item => item.id === filters.workspace)?.name || 'Unavailable workspace';
  const statusLabel =
    statuses.find(item => item.value === filters.status)?.label || filters.status;
  const clear = () =>
    onChange({
      date: 'All my work',
      workspace: '',
      project: '',
      status: '',
      relation: '',
      recent: false,
    });
  const chip = (label: string, remove: () => void) => (
    <button type="button" className="r10-filter-chip" aria-label={`Remove ${label} filter`} onClick={remove}>
      <span>{label}</span>
      <X size={14} aria-hidden="true" />
    </button>
  );
  return <>
    <div className="r10-toolbar">
      <label className="r10-search"><span className="sr-only">Search work</span><Search size={17} aria-hidden="true" />
        <input id="personal-work-search" aria-label="Search personal work" type="search" placeholder="Search tasks, subtasks, or projects…" value={filters.query} onChange={event => onChange({ query: event.target.value })} />
        {filters.query && <WorkspaceTooltip content="Clear search"><button type="button" aria-label="Clear search" onClick={() => onChange({ query: '' })}><X size={16} aria-hidden="true" /></button></WorkspaceTooltip>}
      </label>
      <div className="r10-inline-controls">
        {destination !== 'History' && (
          <div className="r10-quick-filters" role="group" aria-label="Work date filters">
            {dateFilters.map(date => (
              <button
                type="button"
                key={date}
                aria-pressed={filters.date === date}
                className={`r10-quick-chip ${filters.date === date ? 'is-active' : ''}`}
                onClick={() => onChange({ date })}
              >
                {date === 'All my work' ? 'All due dates' : date}
              </button>
            ))}
          </div>
        )}
        {workspaces.length > 1 && (
          <label className="r10-inline-scope" htmlFor={scopeId}>
            <span className="sr-only">Workspace scope</span>
            <select id={scopeId} aria-label="Workspace scope" value={filters.workspace} onChange={event => onChange({ workspace: event.target.value })}>
              <option value="">All workspaces</option>
              {filters.workspace && !workspaces.some(item => item.id === filters.workspace) && <option value={filters.workspace}>Unavailable workspace</option>}
              {workspaces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        <WorkspacePopover open={open} onOpenChange={setOpen} collisionPadding={16} contentClassName="r10-filter-popover"
          trigger={<Button type="button" variant="outline" aria-label={count ? `Filters, ${count} active` : 'Filters'}><SlidersHorizontal size={16} aria-hidden="true" />Filters{popoverCount > 0 && <span className="r10-filter-count">{popoverCount}</span>}</Button>}>
          <section aria-label="Work filters">
            <div className="r10-filter-heading"><h2>Filter work</h2>{count > 0 && <Button type="button" variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}</div>
            <label className="r10-scope" htmlFor={statusId}>
              <span>Status</span>
              <select id={statusId} aria-label="Filter by status" value={filters.status} onChange={event => onChange({ status: event.target.value })}>
                <option value="">All statuses</option>
                {filters.status && !statuses.some(item => item.value === filters.status) && (
                  <option value={filters.status}>{statusLabel}</option>
                )}
                {statuses.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="r10-scope" htmlFor={projectId}>
              <span>Project</span>
              <select id={projectId} aria-label="Filter by project" value={filters.project} onChange={event => onChange({ project: event.target.value })}>
                <option value="">All projects</option>
                {filters.project && !projects.includes(filters.project) && (
                  <option value={filters.project}>{filters.project}</option>
                )}
                {projects.map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </label>
            <label className="r10-scope" htmlFor={roleId}>
              <span>Your role</span>
              <select id={roleId} aria-label="Filter by your role" value={filters.relation} onChange={event => onChange({ relation: event.target.value })}>
                <option value="">All roles</option>
                {filters.relation && !relations.includes(filters.relation) && (
                  <option value={filters.relation}>{filters.relation}</option>
                )}
                {relations.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            {destination === 'History' && (
              <fieldset><legend>Due date</legend><div className="r10-date-filters" role="group" aria-label="Work date filters">{dateFilters.map(date => <button type="button" key={date} aria-pressed={filters.date === date} onClick={() => onChange({ date })}>{date}</button>)}</div></fieldset>
            )}
            {destination === 'History' && <label className="r10-recent"><input type="checkbox" checked={filters.recent} onChange={event => onChange({ recent: event.target.checked })} /><span>Recently completed<small>Last 7 days by last update</small></span></label>}
            <p className="r10-filter-help">Dates follow each item&apos;s workspace timezone.</p>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Done</Button>
          </section>
        </WorkspacePopover>
      </div>
    </div>
    {count > 0 && <div className="r10-active-filters" aria-label="Active work filters">
      {filters.date !== 'All my work' && chip(filters.date, () => onChange({ date: 'All my work' }))}
      {filters.workspace && chip(workspace, () => onChange({ workspace: '' }))}
      {filters.status && chip(`Status: ${statusLabel}`, () => onChange({ status: '' }))}
      {filters.project && chip(`Project: ${filters.project}`, () => onChange({ project: '' }))}
      {filters.relation && chip(`Role: ${filters.relation}`, () => onChange({ relation: '' }))}
      {recent && chip('Recently completed', () => onChange({ recent: false }))}
      <Button type="button" variant="ghost" size="sm" onClick={clear}>Clear filters</Button>
    </div>}
  </>;
}
