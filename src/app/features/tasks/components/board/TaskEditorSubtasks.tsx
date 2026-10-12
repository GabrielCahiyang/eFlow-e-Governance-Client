import {createContext,useContext,type ReactNode} from 'react';
import {useAuth} from '../../../../contexts/AuthContext';
import {Button} from '../../../../components/ui/button';
import type {Employee} from '../../../../services/employeeService';
import type {Task} from '../../../../services/taskService';
import {supportsNestedWork,useWorkTree,WorkRootOwner,isCurrentWorkSnapshot,type WorkTreeController} from '../../../nested-work';
import {TaskSubtasksWidget} from '../../../subtasks';

interface Props {task:Task;employees:Employee[];readOnly:boolean}
const EditorWorkContext=createContext<WorkTreeController|undefined>(undefined);
export interface LegacyEditorStaffingScope {rootId:string;actorId:string;code:'PGRST202'}
export function TaskEditorSaveButton({task,saving,onSave}:{task:Task;saving:boolean;onSave:(legacy?:LegacyEditorStaffingScope)=>void}){
 const controller=useContext(EditorWorkContext),{user}=useAuth();
 const legacy=controller?.unavailable&&!controller.loading&&!controller.pending&&!controller.error&&controller.rootId===task.id&&user?.id&&controller.actorId===user.id?{rootId:task.id,actorId:user.id,code:'PGRST202' as const}:undefined;
 return <Button disabled={saving} onClick={()=>legacy?onSave(legacy):onSave()}>{saving?'Saving...':'Save changes'}</Button>;
}
export function TaskEditorWorkOwner({task,children}:{task:Task;children:ReactNode}){
 return supportsNestedWork(task)?<ConnectedOwner task={task}>{children}</ConnectedOwner>:<>{children}</>;
}
function ConnectedOwner({task,children}:{task:Task;children:ReactNode}){
 const controller=useWorkTree(task.id);
 return <EditorWorkContext.Provider value={controller}>{children}</EditorWorkContext.Provider>;
}
export function TaskEditorRootPeople({task,readOnly,fallback}:{task:Task;readOnly:boolean;fallback:ReactNode}){
 const controller=useContext(EditorWorkContext),{user}=useAuth();
 if(!supportsNestedWork(task))return <>{fallback}</>;
 const data=controller?.data;
 if(!controller||controller.actorId!==(user?.id||null)||controller.rootId!==task.id||data&&(data.root.project!==task.linkedProjectId||data.root.kind==='office'&&data.root.office!==task.orgId||!isCurrentWorkSnapshot(data,{actorId:user?.id||null,rootId:task.id,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision})))return <p role="alert">Work people are unavailable in the current actor or task scope.</p>;
 return <WorkRootOwner rootId={task.id} controller={controller} readOnly={readOnly||!!task.archivedAt||['for_review','completed','cancelled'].includes(task.status)} fallback={fallback}/>;
}
/** Supported work shares one verified owner through hierarchy and Inspector. */
export function TaskEditorSubtasks(props:Props){
 const controller=useContext(EditorWorkContext);
 return <Checklist {...props} controller={controller}/>;
}
function Checklist({task,employees,readOnly,controller}:Props&{controller?:WorkTreeController}){
 return <TaskSubtasksWidget taskId={task.id} parentTask={task} readOnly={readOnly} controller={controller} canManage
  allowedAssignees={employees.map(employee=>({id:employee.id,name:employee.name,initials:employee.initials}))}/>;
}
