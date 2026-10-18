import { useState } from 'react';
import { Button } from '@vibe/core';
import { useProjectGroups } from '../hooks/useProjectGroups';
import { CreateWorkDialog } from './CreateWorkDialog';
import { requestNavigation } from '../../../shared/navigationGuard';

/** Every layout creates the same canonical task, in a chosen table group. */
export function ProjectTaskCreateAction({ projectId }: { projectId: string }) {
  const { groups, loading, error, refresh } = useProjectGroups(projectId);
  const [open, setOpen] = useState<'task' | 'group'>();
  return <div className="eflow-project-task-create">
    <Button size="small" disabled={loading || !!error} onClick={() => { void requestNavigation(() => setOpen(groups.length ? 'task' : 'group')); }}>{loading ? 'Loading groups…' : groups.length ? '+ Task' : '+ First group'}</Button>
    {!loading && !error && !groups.length && <span>Create a group first, then add your tasks.</span>}
    {error && <span role="alert">{error} <Button kind="tertiary" size="small" onClick={() => void refresh().catch(() => {})}>Retry groups</Button></span>}
    {open && <CreateWorkDialog kind={open} projectId={projectId} groups={groups} onClose={() => setOpen(undefined)} onCreated={() => { void refresh().catch(() => {}); }}/ >}
  </div>;
}
