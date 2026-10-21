import { useMemo, useState } from 'react';
import { Button, Heading } from '@vibe/core';
import { Search } from 'lucide-react';
import { Add } from '@vibe/icons';
import { EmptyState } from '../../../components/ui/EmptyState';
import type { Organization, UserProfile } from '../../../types';
import type { Task } from '../../tasks';
import type { Project } from '../services/types';
import { ProjectsPortfolioTable } from './ProjectsPortfolioTable';

/** Browses only the access-filtered project snapshot supplied by the workspace. */
export function ProjectIndex({ projects, tasks, organizations, profiles, onOpen, onOpenProposal, onCreate }: {
  projects: Project[]; tasks: Task[]; organizations: Organization[]; profiles: UserProfile[];
  onOpen: (id: string) => void; onOpenProposal: (id: string) => void; onCreate?: () => void;
}) {
  const [query, setQuery] = useState(''), [status, setStatus] = useState('current'), [sort, setSort] = useState('updated'), [office, setOffice] = useState('');
  const visible = useMemo(() => projects.filter(project =>
    (!office || project.orgId === office) && (status === 'all' || (status === 'current' ? project.status !== 'archived' : project.status === status)) &&
    `${project.title} ${project.description || ''} ${organizations.find(office => office.id === project.orgId)?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'target'
    ? (a.targetDate || '9999').localeCompare(b.targetDate || '9999') : b.updatedAt - a.updatedAt), [projects, organizations, query, status, sort, office]);
  const reset = () => { setQuery(''); setStatus('current'); setOffice(''); };
  return <section className="eflow-project-index" aria-label="All projects">
    <header><div><Heading type="h1">All projects</Heading><p>Your projects, teams and progress in one place.</p></div>{onCreate && <Button size="medium" leftIcon={Add} onClick={onCreate}>Create project</Button>}</header>
    <div className="eflow-project-index__filters">
      <label>Search projects<span className="eflow-project-index__search"><Search size={17} aria-hidden="true"/><input type="search" placeholder="Search by project or office" value={query} onChange={event => setQuery(event.target.value)}/></span></label>
      <label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="current">Current projects</option><option value="all">All statuses</option><option value="planning">Planning</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
      <label>Sort projects<select value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="name">Project name</option><option value="target">Target date</option></select></label>
      <label>Lead office<select value={office} onChange={event=>setOffice(event.target.value)}><option value="">All offices</option>{organizations.filter(item=>projects.some(project=>project.orgId===item.id)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </div>
    <div className="eflow-project-index__results"><p role="status">{visible.length} of {projects.length} projects</p>{(query || office || status !== 'current') && <Button kind="tertiary" size="small" onClick={reset}>Clear filters</Button>}</div>
    {visible.length ? <ProjectsPortfolioTable projects={visible} tasks={tasks} organizations={organizations} profiles={profiles} onOpen={onOpen} onOpenProposal={onOpenProposal}/>
      : <EmptyState illustration={projects.length ? 'search' : 'projects'} size="page" title={projects.length ? 'No projects match these filters' : 'No projects yet'} description={projects.length ? 'Try another name or status.' : onCreate ? 'Create your first project, then add your team and tasks.' : 'Projects shared with you will appear here.'}/>}
  </section>;
}
