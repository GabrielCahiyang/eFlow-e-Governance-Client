import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTasksData } from '../../../hooks/useSupabaseData';
import { fetchPersonalSubtaskReviews, fetchTaskSubtasks } from '../../subtasks';
import { TaskInspector, useTaskInspector } from '../../task-inspector';
import { canUserReviewTask } from '../../reviews';
import { queueNotificationNavigationIntent, type NotificationNavigationIntent } from '../../notifications';
import type { Notification } from '../../../services/notificationService';
import { requestNavigation } from '../../../shared/navigationGuard';
import { pushNavigationHistory } from '../../../shared/navigationHistory';
import { canOpenNavigationSection, getNavigationUrl } from '../../navigation';
import { Button } from '../../../components/ui/button';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { usePersonalFeed } from '../hooks/usePersonalFeed';
import { personalReviewActions, type ActionItem } from '../selectors';
import { resolveInboxUpdateDestination } from '../services/updateDestination';
import { UpdatesFeed } from './UpdatesFeed';

export function ActionCenter({role,hasLeadingWork=false}: {role:string;hasLeadingWork?:boolean}) {
  const {user,can} = useAuth();
  const {tasks,loading,error,retry} = useTasksData();
  const [category,setCategory] = useState<'actions'|'updates'>('actions');
  const [notice,setNotice] = useState('');
  const canReview = role !== 'admin' && (can('navigation.reviews') || hasLeadingWork);
  const subtasks = usePersonalFeed(user?.id,fetchPersonalSubtaskReviews,canReview);
  const inspector = useTaskInspector(`inbox:${user?.id}`);
  const selected = tasks.find(task=>task.id===inspector.taskId) || null;
  useEffect(()=>{setNotice('');setCategory(role === 'admin'?'updates':'actions');},[user?.id,role]);
  const actions = personalReviewActions(error?[]:tasks,subtasks.error?[]:subtasks.rows,user?.id,role);
  const navigate = (section: string,page: string,intent?:NotificationNavigationIntent) => void requestNavigation(()=>{
    if(intent) queueNotificationNavigationIntent(intent);
    pushNavigationHistory(getNavigationUrl(section,page));
  });
  const openAction = (item: ActionItem) => {
    if(item.source==='task-review') {
      if(!tasks.some(task=>task.id===item.taskId && canUserReviewTask(task,user?.id,role) && task.status==='for_review')) {setNotice('This submission was withdrawn or is no longer yours to review. Refresh the queue.');return;}
      inspector.openTask(item.taskId,{view:'Inbox',restoreFocus:()=>(document.querySelector<HTMLElement>(`[data-action-key="${item.key}"]`) || document.getElementById("inbox-refresh-actions") || document.getElementById("inbox-updates"))?.focus()});
    } else {
      if(!personalReviewActions([],subtasks.rows,user?.id,role).some(row=>row.key===item.key)){setNotice('This subtask submission is no longer yours to review. Refresh the queue.');return;}
      navigate('reviews','For Review',{notificationId:item.key,kind:'subtask_review',taskId:item.taskId,entityLabel:item.entityLabel,entityId:item.entityId});
    }
  };
  const recipientRef = useRef(user?.id); recipientRef.current = user?.id;
  const openUpdate = async (item: Notification) => {
    const recipient = user?.id, href = window.location.href;
    const destination=resolveInboxUpdateDestination(item,role);
    setNotice('');
    if(item.taskId && !tasks.some(task=>task.id===item.taskId)) {setNotice('The referenced task is unavailable, deleted or outside your access. Open your current work or review queue.');return;}
    if(!destination || !canOpenNavigationSection(role,destination.section,can,hasLeadingWork && ['leading','reviews'].includes(destination.section))) {setNotice('This update has no available destination under your current access. Your current queues remain available.');return;}
    if(item.taskId && destination && ['task','leading_task','task_review'].includes(destination.intent.kind)) {
      inspector.openTask(item.taskId,{view:'Inbox Updates',restoreFocus:() => (document.querySelector<HTMLElement>(`[data-update-id="${item.id}"]`) || document.getElementById('inbox-updates'))?.focus()});return;
    }
    if (['subtask','subtask_review'].includes(destination.intent.kind)) {
      try {
        const label = destination.intent.entityLabel?.trim().toLowerCase();
        const children = destination.intent.kind === 'subtask_review'
          ? subtasks.rows.map(row => row.subtask)
          : item.taskId ? await fetchTaskSubtasks(item.taskId) : [];
        if (recipientRef.current !== recipient || window.location.href !== href) return;
        const matches = children.filter(child => child.taskId === item.taskId && !!label && child.title.trim().toLowerCase() === label && (destination.intent.kind === 'subtask_review' || child.assignedToIds.includes(recipient || '') || child.assignedTo === recipient));
        if(matches.length !== 1) {setNotice('The referenced subtask is unavailable or its older label is ambiguous. Open the current subtask queue or inspect its accessible parent task.');return;}
        destination.intent.entityId = matches[0].id;
      } catch(caught) {setNotice(caught instanceof Error ? caught.message : 'The subtask destination could not be checked.');return;}
    }
    navigate(destination.section,destination.page,destination.intent);
  };
  return <section className="space-y-5 min-w-0" aria-label="Personal Inbox">
    <header><p className="text-xs text-muted-foreground">Personal action center</p><h1 className="text-2xl font-semibold">Inbox</h1><p className="text-sm text-muted-foreground mt-1">Discover work that needs your attention. Each decision stays with its existing workflow.</p></header>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Inbox categories"><Button aria-pressed={category==='actions'} variant={category==='actions'?'default':'outline'} onClick={()=>void requestNavigation(()=>setCategory('actions'))}>Needs action</Button><Button id="inbox-updates" aria-pressed={category==='updates'} variant={category==='updates'?'default':'outline'} onClick={()=>void requestNavigation(()=>setCategory('updates'))}>Updates</Button></div>
    {notice && <FeedbackState tone="warning" title="Update destination unavailable">{notice}</FeedbackState>}
    {category==='updates'?<UpdatesFeed onOpen={item => void openUpdate(item)}/>:<>
      {!canReview?<FeedbackState title="No review queue under your current access">Updates remain available. Account roles do not grant operational approval authority.</FeedbackState>:<>
        <div className="flex flex-wrap items-center gap-2"><p className="flex-1 text-sm text-muted-foreground">Task reviews: {loading?'loading':error?'unavailable':actions.filter(item=>item.source==='task-review').length} · Subtask reviews: {subtasks.loading?'loading':subtasks.error?'unavailable':actions.filter(item=>item.source==='subtask-review').length}</p><Button id="inbox-refresh-actions" variant="outline" onClick={()=>{retry();subtasks.retry();}}>Refresh actions</Button></div>
        {error && <FeedbackState tone="error" title="Task reviews could not be loaded" onRetry={retry}>{error.message}</FeedbackState>}
        {subtasks.error && <FeedbackState tone="error" title="Subtask reviews could not be loaded" onRetry={subtasks.retry}>{subtasks.error}</FeedbackState>}
        {loading || subtasks.loading ? <p role="status">Refreshing review sources…</p>:null}
        {!actions.length && !loading && !subtasks.loading && !error && !subtasks.error && <FeedbackState title="No personal task or subtask reviews pending">Other review queues remain with their workflow owners below.</FeedbackState>}
        <ul className="rounded-lg border border-border divide-y divide-border bg-card">{actions.map(item=><li key={item.key}><button data-action-key={item.key} onClick={()=>openAction(item)} className="w-full text-left px-4 py-3 hover:bg-muted/50"><span className="block font-medium break-words">{item.title}</span><span className="block text-xs text-muted-foreground mt-1 break-words">{item.source==='task-review'?'Task review':'Subtask review'} · {item.context}</span><span className="block text-xs text-primary mt-2">Open review</span></button></li>)}</ul>
        <div className="space-y-2"><h2 className="font-medium">Other workflow queues</h2><p className="text-sm text-muted-foreground">Funding, workplan and governance eligibility and counts are checked in their own queues.</p><Button variant="outline" onClick={()=>navigate('reviews','For Review')}>Open all review queues</Button></div>
      </>}
      {role==='accounting_staff' && can('navigation.accounting_overview') && <Button variant="outline" onClick={()=>navigate('accounting_overview','Accounting Overview')}>Open Accounting</Button>}
    </>}
    <TaskInspector task={selected} taskId={inspector.taskId || undefined} origin={inspector.origin} onClose={inspector.close} readOnly={role==='admin' || !!error} canDiscuss canReview={!!selected && canReview && canUserReviewTask(selected,user?.id,role)} />
  </section>;
}
