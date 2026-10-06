import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useProjectsData } from '../../../hooks/useSupabaseData';
import { formatDate } from '../../../components/workflow/primitives';
import { useCurrentUserTasks } from '../../../hooks/useCurrentUserTasks';
import { isTaskLead } from '../../tasks';
import { TaskInspector, useTaskInspector } from '../../task-inspector';
import { canUserReviewTask } from '../../reviews';
import { requestNavigation } from '../../../shared/navigationGuard';
import { pushNavigationHistory } from '../../../shared/navigationHistory';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { TaskStatusBadge } from '../../../components/workflow/StatusBadges';
import { selectPersonalWork, workBuckets, personalTaskRelation, type WorkBucket } from '../selectors';
import { getNavigationUrl } from '../../navigation';

export function PersonalWorkWorkspace() {
  const { userProfile } = useAuth();
  const { tasks, loading, error, retry, userId } = useCurrentUserTasks();
  const [bucket, setBucket] = useState<WorkBucket>('All my work');
  const [query, setQuery] = useState('');
  const inspector = useTaskInspector(`personal:${userId}`);
  useEffect(() => { setQuery(''); setBucket('All my work'); }, [userId]);
  const { projects } = useProjectsData();
  const contextTasks = tasks.map(task => ({...task,projectTitle:projects.find(project => project.id === task.linkedProjectId)?.title || task.projectTitle}));
  const rows = selectPersonalWork(contextTasks, userId, bucket, query);
  const selected = tasks.find(task => task.id === inspector.taskId) || null;
  const navigate = (section: string, page: string) => void requestNavigation(() => pushNavigationHistory(getNavigationUrl(section,page)));
  return <section className="space-y-5 min-w-0" aria-label="My Work">
    <header><p className="text-xs text-muted-foreground">Personal workspace</p><h1 className="text-2xl font-semibold">My Work</h1><p className="text-sm text-muted-foreground mt-1">Your assigned work, team contributions and tasks you lead across accessible projects.</p></header>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => navigate('subtasks', 'My Subtasks')}>My subtasks</Button>
      <Button variant="outline" onClick={() => navigate('inbox','Inbox')}>Open Inbox</Button>
    </div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Personal work filters">{workBuckets.map(value => <Button key={value} variant={value === bucket ? 'default' : 'outline'} aria-pressed={value === bucket} onClick={() => void requestNavigation(() => setBucket(value))}>{value}</Button>)}</div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex-1 min-w-0 text-sm">Search work<input type="search" id="personal-work-search" aria-label="Search personal work" className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2" value={query} onChange={event => { const value = event.target.value; void requestNavigation(() => setQuery(value)); }} /></label>
      {query && <Button variant="ghost" onClick={() => void requestNavigation(() => setQuery(''))}>Clear search</Button>}
      <Button variant="outline" disabled={loading} onClick={retry}>Refresh work</Button>
    </div>
    {loading ? <p role="status">Loading personal work…</p> : error ? <FeedbackState tone="error" title="Personal work could not be refreshed" onRetry={retry}>{error.message}</FeedbackState> : <>
      <p className="text-sm text-muted-foreground" role="status">{rows.length} tasks · {bucket}{bucket === 'Recently completed' ? ' · last 7 calendar days, by last update' : ''}</p>
      {!rows.length ? <FeedbackState title={query ? 'No matching tasks' : 'No tasks in this filter'}>Choose another filter or clear your search. Cancelled and archived tasks remain in Task History.</FeedbackState> : <ul className="rounded-lg border border-border divide-y divide-border bg-card">{rows.map(task => <li key={task.id}><button className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50" data-personal-task={task.id} onClick={event => inspector.openTask(task.id,{view:'My Work', returnFocus:event.currentTarget, restoreFocus:() => (document.querySelector<HTMLElement>(`[data-personal-task="${task.id}"]`) || document.getElementById("personal-work-search"))?.focus()})}>
        <span className="flex-1 min-w-0"><span className="block font-medium break-words">{task.title}</span><span className="block text-xs text-muted-foreground mt-1 break-words">{task.projectTitle || task.activityTitle || 'Office work'} · {task.teamName || task.department || 'Assigned Office'} · {personalTaskRelation(task,userId)}</span><span className="block text-xs text-muted-foreground mt-1">Due {task.deadline || task.dueDate ? formatDate(task.deadline || task.dueDate) : 'date not set'} · {task.percentComplete || 0}% complete</span></span><TaskStatusBadge status={task.status} size="sm" />
      </button></li>)}</ul>}
    </>}
    <TaskInspector task={selected} taskId={inspector.taskId || undefined} origin={inspector.origin} onClose={inspector.close} readOnly={!!error} canDiscuss canPostProgress canSubmitForReview={!!selected && isTaskLead(selected,userId)} canReview={!!selected && canUserReviewTask(selected,userId,userProfile?.role)} />
  </section>;
}
