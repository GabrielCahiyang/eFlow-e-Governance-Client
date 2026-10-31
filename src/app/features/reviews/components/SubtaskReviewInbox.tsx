import {useEffect,useState,type ReactNode} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {requestNavigation} from '../../../shared/navigationGuard';
import {SubtaskWorkDrawer,type Subtask} from '../../subtasks';
import {fetchTaskById,rowToTask,type Task} from '../../tasks';
import {fetchSubitemInspectorRecord} from '../../subtasks';
import {useNotificationNavigationIntent,type NotificationNavigationIntent} from '../../notifications';
import type {SubitemReviewDetailProps} from './SubitemReviewDetail';

type Props={onShowTasks:()=>void;onShowBudget?:()=>void;focus?:NotificationNavigationIntent|null;embedded?:boolean;readOnly?:boolean;renderDetail?:(props:SubitemReviewDetailProps)=>ReactNode};
/** Retained links open current work. Separate subitem review is retired. */
export function SubtaskReviewInbox(props:Props){
 const {user}=useAuth();return <RetiredSubitemReviews key={JSON.stringify([user?.id,props.focus?.taskId,props.focus?.entityId])} {...props}/>;
}
function RetiredSubitemReviews({focus,onShowTasks,readOnly=false}:Props){
 const [target,setTarget]=useState<{task:Task;subtask:Subtask}>(),[error,setError]=useState('');
 const [pending,setPending]=useState(!!focus),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  if(!focus?.taskId||!focus.entityId){setPending(false);return;}
  setPending(true);setError('');
  void Promise.all([fetchTaskById(focus.taskId),fetchSubitemInspectorRecord(focus.taskId,focus.entityId)]).then(([task,record])=>{
   if(!task||task.id!==focus.taskId)throw new Error('The referenced task is no longer accessible.');
   if(active)setTarget({task:rowToTask(task),subtask:record.subtask});
  }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not open this subtask.');}).finally(()=>{if(active)setPending(false);});
  return()=>{active=false;};
 },[focus?.taskId,focus?.entityId,retry]);
 useNotificationNavigationIntent(intent=>intent.kind==='subtask_review'&&intent.notificationId===focus?.notificationId,async()=>!pending,[pending,target,error]);
 if(target)return <SubtaskWorkDrawer parentTask={target.task} subtask={target.subtask} readOnly={readOnly} initialSection="work" onClose={()=>void requestNavigation(onShowTasks)}/>;
 return <section className="space-y-3 p-5" aria-label="Subtask completion">
  <h2 className="text-lg font-semibold">Subtasks complete directly</h2>
  <p>The task lead manages these steps. Open a subtask to update or complete it. Final approval stays with the parent task.</p>
  {pending&&<p role="status">Opening the referenced work...</p>}
  {error&&<><p role="alert">{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Retry opening work</button></>}
  <button type="button" className="rounded-md bg-teal-700 px-4 py-2 text-white" onClick={()=>void requestNavigation(onShowTasks)}>Go to task reviews</button>
 </section>;
}
