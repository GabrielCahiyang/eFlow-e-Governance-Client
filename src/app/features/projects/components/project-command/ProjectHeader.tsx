import { useState, type ReactNode } from 'react';
import type { Organization, UserProfile } from '../../../../types';
import type { Project } from '../../services/types';
import { ProjectLifecycleLabel, ProjectScheduleLabel } from '../../presentation/projectPresentation';
import { InlineEditableText } from '../../../../components/ui/workspace';
import { Button } from '../../../../components/ui/button';
import type { ProjectCommandMetrics } from './types';
import './projectIdentity.css';
import { projectOperationError } from '../../presentation/projectOperationError';

export function ProjectHeader({ project, organizations, profiles, metrics, editable = false, onTitleChange, participants, utilities, readinessSummary, onReadiness, onOffices, hideTitle = false }: {
  project: Project; organizations: Organization[]; profiles?: UserProfile[]; metrics?: ProjectCommandMetrics; hideTitle?: boolean;
  editable?: boolean; onTitleChange?: (title: string) => Promise<void>; participants?: ReactNode; utilities?: ReactNode; readinessSummary?: ReactNode; onReadiness?: () => void; onOffices?: () => void;
}) {
  const [titleNotice, setTitleNotice] = useState('');
  const organization = organizations.find(item => item.id === project.orgId);
  const owner = profiles?.find(profile => profile.id === project.ownerId);
  const closed = ['completed', 'archived'].includes(project.status);
  const saveTitle = async (title: string) => {
    setTitleNotice('Saving project name…');
    try { await onTitleChange?.(title); setTitleNotice('Project name saved.'); }
    catch (error) { setTitleNotice(''); throw new Error(projectOperationError(error, 'Could not save the project name.')); }
  };
  return <header className="eflow-project-identity" data-tour-id="project-table-heading">
    <div className="eflow-project-identity__top">
      <div className="eflow-project-identity__identity">
        <p className="eflow-project-identity__office">{organization?.name || 'Office not set'} · {owner?.full_name || 'Owner unavailable'}</p>
        {!hideTitle && <h1 aria-label={project.title}>{onTitleChange ? <InlineEditableText value={project.title} label="project name" disabled={!editable || closed} onSave={saveTitle} /> : project.title}</h1>}
        <div className="eflow-project-identity__signals"><ProjectLifecycleLabel status={project.status} />{metrics && <ProjectScheduleLabel health={metrics.scheduleHealth} empty={!project.targetDate && !metrics.nextDeadline} />}</div>
        {metrics && <p>{metrics.taskCompleted} / {metrics.taskTotal} tasks completed · {metrics.progress}% complete{metrics.overdue ? ` · ${metrics.overdue} overdue` : ''}</p>}
        {participants}
      </div>
      {utilities}
    </div>
    <div className="eflow-project-identity__context">
      <div><span>Readiness</span>{readinessSummary || <p>Review required checks before activation or closeout.</p>}</div>
      <div className="eflow-project-identity__context-actions">
        {onOffices && <Button variant="outline" onClick={onOffices}>Project Offices</Button>}
        {onReadiness && <Button variant="secondary" onClick={onReadiness}>Readiness &amp; closeout</Button>}
      </div>
    </div>
    {closed && <p role="status">{project.status === 'archived' ? 'Archived' : 'Completed'} project details are read-only. History and reports remain available.</p>}
    <span className="sr-only" aria-live="polite">{titleNotice}</span>
  </header>;
}
