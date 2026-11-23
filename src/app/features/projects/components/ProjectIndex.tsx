import { orderedStatusLabels, useWorkStatuses } from '../../work-status';
import { useMemo, useRef, useState } from 'react';
import { Button, Heading } from '@vibe/core';
import { ChevronDown, Plus, Search, ShieldCheck } from 'lucide-react';
import { Button as MenuButton } from '../../../components/ui/button';
import { useAuth } from '../../../contexts/AuthContext';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ActionMenu } from '../../../components/ui/workspace';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { Organization, UserProfile } from '../../../types';
import type { Task } from '../../tasks';
import type { Project } from '../services/types';
import { effectiveProjectLifecycleStatus } from '../services/projectMappers';
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
  const { userProfile } = useAuth();
  const {definitions}=useWorkStatuses();
  const [query, setQuery] = useState(''), [status, setStatus] = useState('current'), [sort, setSort] = useState('updated'), [office, setOffice] = useState('');
  const pendingHeadProjects = useMemo(
    () =>
      projects.filter((project) => {
        if (project.status !== 'planning' || project.projectApprovalStatus !== 'pending_head') return false;
        if (!userProfile?.id || userProfile.is_active === false) return false;
        const org = organizations.find((item) => item.id === project.orgId);
        return Boolean(
          project.orgId &&
            userProfile.org_id === project.orgId &&
            (org?.head_user_id === userProfile.id || userProfile.role === 'head'),
        );
      }),
    [projects, organizations, userProfile],
  );
  const visible = useMemo(() => projects.filter(project => {
    const eff = effectiveProjectLifecycleStatus(project);
    const statusMatch =
      status === 'all' ||
      (status === 'current'
        ? project.status !== 'archived'
        : eff === status || (status === 'active' && eff === 'pending_completion'));
    return (
      (!office || project.orgId === office) &&
      statusMatch &&
      `${project.title} ${project.description || ''} ${organizations.find(office => office.id === project.orgId)?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase())
    );
  }).sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'target'
    ? (a.targetDate || '9999').localeCompare(b.targetDate || '9999') : b.updatedAt - a.updatedAt), [projects, organizations, query, status, sort, office]);
  const reset = () => { setQuery(''); setStatus('current'); setOffice(''); };
  return <section className="eflow-project-index" aria-label="All projects">
    <header><div><Heading type="h1">All projects</Heading><p>Your projects, teams and progress in one place.</p></div>{onCreate && <ProjectCreationMenu onCreate={onCreate}/>}</header>
    <div className="eflow-project-index__filters">
      <label>Search projects<span className="eflow-project-index__search"><Search size={17} aria-hidden="true"/><input type="search" maxLength={120} placeholder="Search by project or office" value={query} onChange={event => setQuery(event.target.value)}/></span></label>
      <label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="current">Current projects</option><option value="all">All statuses</option>{orderedStatusLabels(definitions,{planning:'Planning',pending:'Pending approval',waiting_for_activation:'Waiting for activation',active:'Active',pending_completion:'Pending completion',on_hold:'On hold',completed:'Completed',archived:'Archived'}).map(({id,label})=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>Sort projects<select value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="name">Project name</option><option value="target">Target date</option></select></label>
      <label>Lead office<select value={office} onChange={event=>setOffice(event.target.value)}><option value="">All offices</option>{organizations.filter(item=>projects.some(project=>project.orgId===item.id)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div>
    <div className="eflow-project-index__results"><p role="status">{visible.length} of {projects.length} projects</p>{(query || office || status !== 'current') && <Button kind="tertiary" size="small" onClick={reset}>Clear filters</Button>}</div>
    {pendingHeadProjects.length > 0 && (
      <div
        role="status"
        className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <span>
            <strong>{pendingHeadProjects.length}</strong> non-Head project{pendingHeadProjects.length === 1 ? '' : 's'} awaiting Office Head approval before moving to <strong>Waiting for activation</strong>.
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pendingHeadProjects.slice(0, 3).map((item) => (
            <MenuButton key={item.id} type="button" size="sm" variant="outline" onClick={() => onOpen(item.id)}>
              Review “{item.title}”
            </MenuButton>
          ))}
        </div>
      </div>
    )}
    {visible.length ? <ProjectsPortfolioTable projects={visible} tasks={tasks} organizations={organizations} profiles={profiles} onOpen={onOpen} onOpenProposal={onOpenProposal}/>
      : <EmptyState illustration={projects.length ? 'search' : 'projects'} size="page" title={projects.length ? 'No projects match these filters' : 'No projects yet'} description={projects.length ? 'Try another name or status.' : onCreate ? 'Create your first project, then add your team and tasks.' : 'Projects shared with you will appear here.'}/>}
  </section>;
}
