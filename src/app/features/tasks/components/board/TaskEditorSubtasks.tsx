import {createContext,useContext,type ReactNode} from 'react';
import {useAuth} from '../../../../contexts/AuthContext';
import {Button} from '../../../../components/ui/button';
import {ActionBlockerGroup} from '../../../../components/ui/action-blockers';
import type {Employee} from '../../../../services/employeeService';
import {getCachedProjects} from '../../../../services/projectService';
import type {Task} from '../../../../services/taskService';
import {supportsNestedWork,useWorkTree,WorkRootOwner,isCurrentWorkSnapshot,isTaskSubtaskPlanningBlocked,type WorkTreeController} from '../../../nested-work';
import {getTaskLeadId} from '../../selectors/teamMembership';
import {TaskSubtasksWidget} from '../../../subtasks';

interface Props {task:Task;employees:Employee[];readOnly:boolean}
const EditorWorkContext=createContext<WorkTreeController|undefined>(undefined);
export interface LegacyEditorStaffingScope {rootId:string;actorId:string;code:'PGRST202'}
export function TaskEditorSaveButton({task,saving,disabled=false,disabledReason='',onSave}:{task:Task;saving:boolean;disabled?:boolean;disabledReason?:string;onSave:(legacy?:LegacyEditorStaffingScope)=>void}){
 const controller=useContext(EditorWorkContext),{user}=useAuth();
 const legacy=controller?.unavailable&&!controller.loading&&!controller.pending&&!controller.error&&controller.rootId===task.id&&user?.id&&controller.actorId===user.id?{rootId:task.id,actorId:user.id,code:'PGRST202' as const}:undefined;
 const isDisabled=saving||disabled;
 return (
  <ActionBlockerGroup actionLabel="Save changes" blockers={disabled?disabledReason:[]} busy={saving}>
   <Button type="button" disabled={isDisabled} onClick={()=>legacy?onSave(legacy):onSave()}>
    {saving?'Saving...':'Save changes'}
   </Button>
  </ActionBlockerGroup>
 );
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
 if(!controller||controller.actorId!==(user?.id||null)||controller.rootId!==task.id||data&&(data.root.project!==task.linkedProjectId||data.root.kind==='office'&&data.root.office!==task.orgId||!isCurrentWorkSnapshot(data,{actorId:user?.id||null,rootId:task.id,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision})))return <p role="alert">We couldn't confirm access to this task's team. Close this view and open the task again.</p>;
 const projectLeadId=task.linkedProjectId?getCachedProjects()?.find(project=>project.id===task.linkedProjectId)?.projectLeadId:undefined;
 return <WorkRootOwner rootId={task.id} controller={controller} projectLeadId={projectLeadId} readOnly={readOnly||!!task.archivedAt||['for_review','completed','cancelled'].includes(task.status)} fallback={fallback}/>;
}
/** Supported work shares one verified owner through hierarchy and Inspector. */
export function TaskEditorSubtasks(props:Props){
 const controller=useContext(EditorWorkContext);
 return <Checklist {...props} controller={controller}/>;
}
function Checklist({task,employees,readOnly,controller}:Props&{controller?:WorkTreeController}){
 const {user,userProfile}=useAuth();
 const project=task.linkedProjectId?getCachedProjects()?.find(item=>item.id===task.linkedProjectId):undefined;
 const subtaskPlanningBlocked=isTaskSubtaskPlanningBlocked({
  isOfficeProject:Boolean(task.linkedProjectId)&&!task.proposedOfficeIdentityId,
  projectStatus:project?.status??controller?.data?.root.project_status,
  projectLeadId:project?.projectLeadId??controller?.data?.root.project_lead_id,
  taskLeadId:getTaskLeadId(task)||controller?.data?.root.lead||null,
  actorId:user?.id||null,
  actorRole:userProfile?.role||null,
 });
 return <TaskSubtasksWidget taskId={task.id} parentTask={task} readOnly={readOnly||subtaskPlanningBlocked} controller={controller} canManage={!subtaskPlanningBlocked}
  allowedAssignees={employees.map(employee=>({id:employee.id,name:employee.name,initials:employee.initials}))}/>;
}
