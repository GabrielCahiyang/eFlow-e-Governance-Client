import { readableUiError } from '../../../shared/userFacingError';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTasksData } from '../../../hooks/useSupabaseData';
import { fetchPersonalSubtaskReviews, fetchTaskSubtasks } from '../../subtasks';
import { TaskInspector, useTaskInspector } from '../../task-inspector';
import { canUserReviewTask } from '../../reviews';
import { queueNotificationNavigationIntent, resolveNotificationSubitem, fetchNotificationSubitem, type NotificationNavigationIntent } from '../../notifications';
import type { Notification } from '../../../services/notificationService';
import { subscribeWorkChanges } from '../../../shared/workChanges';
import { requestNavigation } from '../../../shared/navigationGuard';
import { isQueryAccessDenied } from '../../../shared/queryAccess';
import { pushNavigationHistory } from '../../../shared/navigationHistory';
import { canOpenNavigationSection, getNavigationUrl,writeNavigationLocation } from '../../navigation';
import {useInboxCategory} from '../hooks/useInboxCategory';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { usePersonalFeed } from '../hooks/usePersonalFeed';
import { personalReviewActions, type ActionItem } from '../selectors';
import { resolveInboxUpdateDestination } from '../services/updateDestination';
import { UpdatesFeed } from './UpdatesFeed';
import { PersonalActionRows, PersonalActionRowsSkeleton } from './PersonalActionRows';
import { AssignedIndependentReviews } from '../../budget';
import '../inbox.css';

const subscribeSubtaskReviews = (_userId: string, invalidate: () => void) => subscribeWorkChanges(invalidate);

export function ActionCenter({role,hasLeadingWork=false,page='Inbox',onNavigate}: {role:string;hasLeadingWork?:boolean;page?:string;onNavigate?:(section:string,page:string)=>void}) {
  const {user,can} = useAuth();
  const {tasks,loading,error,retry} = useTasksData();
  const category=useInboxCategory(page,role);
  const setCategory=(next:'actions'|'updates')=>{const destination=next==='updates'?'Notifications':'Needs action';if(onNavigate)onNavigate('inbox',destination);else void requestNavigation(()=>writeNavigationLocation('inbox',destination));};
  const [notice,setNotice] = useState('');
  const [pendingFinancial,setPendingFinancial] = useState(0);
  const canReview = role !== 'admin' && (can('navigation.reviews') || hasLeadingWork);
  const subtasks = usePersonalFeed(user?.id,fetchPersonalSubtaskReviews,canReview,subscribeSubtaskReviews);
  const inspector = useTaskInspector(`inbox:${user?.id}`);
  const selected = tasks.find(task=>task.id===inspector.taskId) || null;
  useEffect(()=>{setNotice('');},[user?.id,role]);
  const visibleTasks = isQueryAccessDenied(error) ? [] : tasks;
  const actions = personalReviewActions(visibleTasks,subtasks.rows,user?.id,role);
  const navigate = (section: string,page: string,intent?:NotificationNavigationIntent) => void requestNavigation(()=>{
    if(intent) queueNotificationNavigationIntent(intent,user?.id);
    pushNavigationHistory(getNavigationUrl(section,page));
  });
  const openAction = (item: ActionItem) => {
    if (item.source === 'task-review' ? error : subtasks.error) {
      setNotice('Retry the review list before opening this submission.');
      return;
    }
    if(item.source==='task-review') {
      if(!tasks.some(task=>task.id===item.taskId && canUserReviewTask(task,user?.id,role) && task.status==='for_review')) {setNotice('This submission was withdrawn or is no longer yours to review.');return;}
      inspector.openTask(item.taskId,{view:'Inbox',restoreFocus:()=>(document.querySelector<HTMLElement>(`[data-action-key="${item.key}"]`) || document.getElementById("inbox-action-summary") || document.getElementById('inbox-updates-context') || document.getElementById("inbox-updates"))?.focus()});
    } else {
      if(!personalReviewActions([],subtasks.rows,user?.id,role).some(row=>row.key===item.key)){setNotice('This subtask submission is no longer yours to review.');return;}
      navigate('reviews','For Review',{notificationId:item.key,kind:'subtask_review',taskId:item.taskId,entityLabel:item.entityLabel,entityId:item.entityId});
    }
  };
  const recipientRef = useRef(user?.id); recipientRef.current = user?.id;
  const openUpdate = async (item: Notification) => {
    const recipient = user?.id, href = window.location.href;
    const destination=resolveInboxUpdateDestination(item,role);
    setNotice('');
    if(item.taskId && destination?.intent.kind!=='personal_work' && !tasks.some(task=>task.id===item.taskId)&&!(destination?.intent.entityId&&['subtask','leading_task','subtask_review'].includes(destination.intent.kind))) {setNotice('The referenced task is unavailable, deleted or outside your access. Open your current work or review queue.');return;}
    if(!destination || !canOpenNavigationSection(role,destination.section,can,hasLeadingWork && ['leading','reviews'].includes(destination.section))) {setNotice('This update has no available destination under your current access. Your current queues remain available.');return;}
    if(item.taskId && destination && ['task','leading_task','task_review'].includes(destination.intent.kind) && !destination.intent.entityId) {
      inspector.openTask(item.taskId,{view:'Inbox Updates',restoreFocus:() => (document.querySelector<HTMLElement>(`[data-update-id="${item.id}"]`) || document.getElementById('inbox-updates-context') || document.getElementById('inbox-updates'))?.focus()});return;
    }
    if (['subtask','subtask_review'].includes(destination.intent.kind) || (destination.intent.kind==='leading_task'&&destination.intent.entityId)) {
      try {
        if(destination.intent.entityId&&destination.intent.kind!=='subtask_review'){
          await fetchNotificationSubitem(destination.intent,recipient||'',tasks.find(task=>task.id===item.taskId));
          if(recipientRef.current!==recipient||window.location.href!==href)return;
          navigate(destination.section,destination.page,destination.intent);return;
        }
        const children = destination.intent.kind === 'subtask_review'
          ? subtasks.rows.map(row => row.subtask)
          : item.taskId ? await fetchTaskSubtasks(item.taskId) : [];
        if (recipientRef.current !== recipient || window.location.href !== href) return;
        const eligible=children.filter(child=>child.taskId===item.taskId&&(destination.intent.kind==='subtask_review'||child.assignedToIds.includes(recipient||'')||child.assignedTo===recipient||child.leadId===recipient||destination.intent.kind==='leading_task'));
        const target=resolveNotificationSubitem(destination.intent,eligible);
        if(target.status!=='resolved') {setNotice('The referenced subtask is unavailable or its older label is ambiguous. Open the current subtask queue or inspect its accessible parent task.');return;}
        destination.intent.entityId = target.item.id;
      } catch(caught) {setNotice(readableUiError(caught, "The subtask destination could not be checked.", 'read'));return;}
    }
    navigate(destination.section,destination.page,destination.intent);
  };
  const taskReviewCount = actions.filter(item => item.source === 'task-review').length;
  const subtaskReviewCount = actions.filter(item => item.source === 'subtask-review').length;
  return <section className="eflow-personal-inbox space-y-5 min-w-0" aria-label="Personal Inbox">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--eflow-border)] pb-4">
      <div>
        <h1 className="text-[22px] font-semibold text-[var(--eflow-text)]">
          {category === 'updates' ? 'Notifications' : 'Needs action'}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--eflow-text-muted)]">
          {category === 'updates'
            ? 'Recent activity, mentions, and status alerts across your work.'
            : 'Work submissions and financial reviews waiting for your decision.'}
        </p>
      </div>
    </header>
    <div className="inbox-destination-host flex flex-wrap gap-2 lg:hidden" role="group" aria-label="Inbox categories">
      <Button aria-current={category === 'actions' ? 'page' : undefined} aria-pressed={category === 'actions'} variant={category === 'actions' ? 'default' : 'outline'} size="sm" onClick={() => setCategory('actions')}>Needs action</Button>
      <Button id="inbox-updates" aria-current={category === 'updates' ? 'page' : undefined} aria-pressed={category === 'updates'} variant={category === 'updates' ? 'default' : 'outline'} size="sm" onClick={() => setCategory('updates')}>Notifications</Button>
      <Button variant="outline" size="sm" onClick={() => onNavigate ? onNavigate('inbox', 'Messages') : void requestNavigation(() => writeNavigationLocation('inbox', 'Messages'))}>Messages</Button>
    </div>
    {notice && <FeedbackState tone="warning" title="Update destination unavailable">{notice}</FeedbackState>}
    {category === 'updates' ? <UpdatesFeed onOpen={item => void openUpdate(item)} /> : <>
      <AssignedIndependentReviews onPendingChange={setPendingFinancial} />
      {!canReview ? pendingFinancial === 0 ? <FeedbackState title="No review queue under your current access">Notifications remain available. Account roles do not grant operational approval authority.</FeedbackState> : null : <>
        <div id="inbox-action-summary" tabIndex={-1} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-4 py-3">
            <span className="block text-[12px] font-medium text-[var(--eflow-text-muted)]">Task reviews</span>
            <strong className="mt-1 block text-[20px] font-semibold tabular-nums text-[var(--eflow-text)]">
              {loading ? '…' : error ? 'Unavailable' : taskReviewCount}
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-4 py-3">
            <span className="block text-[12px] font-medium text-[var(--eflow-text-muted)]">Subtask reviews</span>
            <strong className="mt-1 block text-[20px] font-semibold tabular-nums text-[var(--eflow-text)]">
              {subtasks.loading ? '…' : subtasks.error ? 'Unavailable' : subtaskReviewCount}
            </strong>
          </div>
        </div>
        {error && <FeedbackState tone={visibleTasks.length ? "warning" : "error"} title={visibleTasks.length ? "Task reviews could not refresh" : "Task reviews could not be loaded"} onRetry={retry}>{readableUiError(error, "Reload the task reviews to check what needs your attention.", 'read')}</FeedbackState>}
        {subtasks.error && <FeedbackState tone={subtasks.rows.length ? "warning" : "error"} title={subtasks.rows.length ? "Subtask reviews could not refresh" : "Subtask reviews could not be loaded"} onRetry={subtasks.retry}>{readableUiError(subtasks.error, "Reload the subtask reviews to check what needs your attention.", 'read')}</FeedbackState>}
        {(loading || subtasks.loading) ? (
          <div role="status" aria-busy="true" className="space-y-2">
            <span className="sr-only">Refreshing review sources…</span>
            {!actions.length && <PersonalActionRowsSkeleton rows={3} />}
          </div>
        ) : null}
        {!pendingFinancial && !actions.length && !loading && !subtasks.loading && !error && !subtasks.error && <EmptyState fill illustration="complete" title="All caught up" description="No task, subtask, or financial reviews are waiting for your decision."/>}
        <PersonalActionRows items={actions} onOpen={openAction} />
        <div className="inbox-workflow-fallback"><Button variant="outline" onClick={() => navigate('reviews', 'For Review')}>Open all review queues</Button></div>
      </>}
      {role === 'accounting_staff' && can('navigation.accounting_overview') && <div className="inbox-workflow-fallback"><Button variant="outline" onClick={() => navigate('accounting_overview', 'Accounting Overview')}>Open Accounting</Button></div>}
    </>}
    <TaskInspector task={selected} taskId={inspector.taskId || undefined} origin={inspector.origin} onClose={inspector.close} readOnly={role === 'admin' || !!error} canDiscuss canReview={!!selected && canReview && canUserReviewTask(selected, user?.id, role)} />
  </section>;
}
