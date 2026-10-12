import {useEffect,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {InspectorPanel} from '../../../shared/motion';
import {requestNavigation} from '../../../shared/navigationGuard';
import {fetchTaskById,rowToTask,type Task} from '../../tasks';
import {SubtaskWorkDrawer,type SubtaskReviewItem} from '../../subtasks';
import type {TaskInspectorOrigin} from '../../task-inspector';

/** Scoped root metadata read; canonical Inspector owns fresh work authority. */
export function ReviewSubitemInspector({item,origin,onClose,readOnly=false}:{item:SubtaskReviewItem;origin:TaskInspectorOrigin;onClose:()=>void;readOnly?:boolean}){
 const {user}=useAuth();
 return <ReviewInspector key={JSON.stringify([user?.id,item.subtask.taskId,item.subtask.id])} item={item} origin={origin} onClose={onClose} readOnly={readOnly}/>;
}
function ReviewInspector({item,origin,onClose,readOnly=false}:{item:SubtaskReviewItem;origin:TaskInspectorOrigin;onClose:()=>void;readOnly?:boolean}){
 const [task,setTask]=useState<Task>(),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setTask(undefined);setError('');void fetchTaskById(item.subtask.taskId).then(row=>{
  if(!active)return;
  if(!row||row.id!==item.subtask.taskId)throw new Error('Subitem root is no longer available.');
  setTask(rowToTask(row));
 }).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Could not verify subitem root.');});return()=>{active=false;};},[item.subtask.taskId,retry]);
 if(task)return <SubtaskWorkDrawer subtask={item.subtask} parentTask={task} initialSection="review" origin={origin} onClose={onClose} readOnly={readOnly}/>;
 return <InspectorPanel open onClose={()=>void requestNavigation(onClose)} ariaLabel="Subtask unavailable" returnFocus={origin.returnFocus} onReturnFocus={origin.restoreFocus} layer={60} className="w-full sm:w-[460px]">
  <div className="p-4"><p role={error?'alert':'status'}>{error||'Verifying current subitem context.'}</p>{error&&<button type="button" onClick={()=>setRetry(value=>value+1)}>Retry subitem root</button>}<button type="button" onClick={()=>void requestNavigation(onClose)}>Close subtask detail</button></div>
 </InspectorPanel>;
}
