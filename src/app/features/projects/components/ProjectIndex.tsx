import { orderedStatusLabels, useWorkStatuses } from '../../work-status';
import { useMemo, useRef, useState } from 'react';
import { Button, Heading } from '@vibe/core';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { Button as MenuButton } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ActionMenu } from '../../../components/ui/workspace';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { Organization, UserProfile } from '../../../types';
import type { Task } from '../../tasks';
import type { Project } from '../services/types';
import { ProjectsPortfolioTable } from './ProjectsPortfolioTable';

type ProjectCreationMode = 'manual' | 'pdf';

function ProjectCreationMenu({ onCreate }: { onCreate: (mode: ProjectCreationMode) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingMode = useRef<ProjectCreationMode | null>(null);

  return <ActionMenu
    trigger={<MenuButton ref={trigger} type="button">
      <Plus aria-hidden="true" /> Create project <ChevronDown aria-hidden="true" />
    </MenuButton>}
    onCloseAutoFocus={event => {
      const mode = pendingMode.current;
      pendingMode.current = null;
      if (!mode) return;
      event.preventDefault();
      trigger.current?.focus();
      // Release the menu's focus and pointer locks before opening the dialog.
      requestAnimationFrame(() => {
        if (trigger.current?.isConnected) void requestNavigation(() => onCreate(mode));
      });
    }}
    actions={[
      { id: 'project', label: 'Create project', onSelect: () => { pendingMode.current = 'manual'; } },
      { id: 'project-ai', label: 'Create project with AI', onSelect: () => { pendingMode.current = 'pdf'; } },
    ]}
  />;
}

/** Browses only the access-filtered project snapshot supplied by the workspace. */
export function ProjectIndex({ projects, tasks, organizations, profiles, onOpen, onOpenProposal, onCreate }: {
  projects: Project[]; tasks: Task[]; organizations: Organization[]; profiles: UserProfile[];
  onOpen: (id: string) => void; onOpenProposal: (id: string) => void; onCreate?: (mode: ProjectCreationMode) => void;
}) {
  const {definitions}=useWorkStatuses();
  const [query, setQuery] = useState(''), [status, setStatus] = useState('current'), [sort, setSort] = useState('updated'), [office, setOffice] = useState('');
  const visible = useMemo(() => projects.filter(project =>
    (!office || project.orgId === office) && (status === 'all' || (status === 'current' ? project.status !== 'archived' : project.status === status)) &&
    `${project.title} ${project.description || ''} ${organizations.find(office => office.id === project.orgId)?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'target'
    ? (a.targetDate || '9999').localeCompare(b.targetDate || '9999') : b.updatedAt - a.updatedAt), [projects, organizations, query, status, sort, office]);
  const reset = () => { setQuery(''); setStatus('current'); setOffice(''); };
  return <section className="eflow-project-index" aria-label="All projects">
    <header><div><Heading type="h1">All projects</Heading><p>Your projects, teams and progress in one place.</p></div>{onCreate && <ProjectCreationMenu onCreate={onCreate}/>}</header>
    <div className="eflow-project-index__filters">
      <label>Search projects<span className="eflow-project-index__search"><Search size={17} aria-hidden="true"/><input type="search" placeholder="Search by project or office" value={query} onChange={event => setQuery(event.target.value)}/></span></label>
      <label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="current">Current projects</option><option value="all">All statuses</option>{orderedStatusLabels(definitions,{planning:'Planning',active:'Active',on_hold:'On hold',completed:'Completed',archived:'Archived'}).map(({id,label})=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>Sort projects<select value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="name">Project name</option><option value="target">Target date</option></select></label>
      <label>Lead office<select value={office} onChange={event=>setOffice(event.target.value)}><option value="">All offices</option>{organizations.filter(item=>projects.some(project=>project.orgId===item.id)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div>
    <div className="eflow-project-index__results"><p role="status">{visible.length} of {projects.length} projects</p>{(query || office || status !== 'current') && <Button kind="tertiary" size="small" onClick={reset}>Clear filters</Button>}</div>
    {visible.length ? <ProjectsPortfolioTable projects={visible} tasks={tasks} organizations={organizations} profiles={profiles} onOpen={onOpen} onOpenProposal={onOpenProposal}/>
      : <EmptyState illustration={projects.length ? 'search' : 'projects'} size="page" title={projects.length ? 'No projects match these filters' : 'No projects yet'} description={projects.length ? 'Try another name or status.' : onCreate ? 'Create your first project, then add your team and tasks.' : 'Projects shared with you will appear here.'}/>}
  </section>;
}
