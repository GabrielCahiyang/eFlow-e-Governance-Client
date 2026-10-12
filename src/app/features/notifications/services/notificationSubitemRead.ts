import {fetchTaskById,rowToTask,type Task} from '../../tasks';
import {fetchSubitemInspectorRecord} from '../../subtasks';
import {supportsNestedWork} from '../../nested-work';
import type {NotificationNavigationIntent} from '../navigation';

/** A canonical notification may point beyond a capped discovery list. Read its
 * exact existing records under RLS, never substitute a same-title sibling or a
 * legacy operation. The Inspector still owns current command capabilities.
 */
export async function fetchNotificationSubitem(intent:NotificationNavigationIntent,actorId:string,knownRoot?:Task){
 if(!actorId||!intent.taskId||!intent.entityId||!['subtask','leading_task'].includes(intent.kind))throw new Error('A current canonical Subitem target is required.');
 let root=knownRoot?.id===intent.taskId?knownRoot:undefined;
 if(!root){const row=await fetchTaskById(intent.taskId);if(row?.id===intent.taskId)root=rowToTask(row);}
 if(!root||!supportsNestedWork(root))throw new Error('The referenced Subitem root is unavailable.');
 const {subtask}=await fetchSubitemInspectorRecord(root.id,intent.entityId);
 if(intent.kind==='subtask'&&subtask.leadId!==actorId&&subtask.assignedTo!==actorId&&!subtask.assignedToIds.includes(actorId))throw new Error('The referenced Subitem is no longer assigned to you.');
 return {...subtask,parentTask:root};
}
