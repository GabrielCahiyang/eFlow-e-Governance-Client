import {supportsNestedWork,useWorkTree,type WorkTreeController} from '../../nested-work';
import {useAuth} from '../../../contexts/AuthContext';
import type {TaskInspectorOrigin} from '../../task-inspector';
import {LegacySubtaskWorkDrawer} from './LegacySubtaskWorkDrawer';
import {SubitemInspector} from './SubitemInspector';

export type SubtaskWorkDrawerProps=Parameters<typeof LegacySubtaskWorkDrawer>[0]&{
 controller?:WorkTreeController;origin?:TaskInspectorOrigin;executionBlocked?:boolean;onChanged?:()=>void;
 initialSection?:'work'|'activity'|'review';
};
/** Retained public facade; excluded work keeps the original workflow. */
export function SubtaskWorkDrawer(props:SubtaskWorkDrawerProps){
 if(!props.subtask)return null;
 if(!props.parentTask||!supportsNestedWork(props.parentTask))return <LegacySubtaskWorkDrawer {...props}/>;
 return props.controller?<SupportedSubtaskWorkDrawer {...props} controller={props.controller}/>:<ConnectedSubtaskWorkDrawer key={props.parentTask.id} {...props}/>;
}
function ConnectedSubtaskWorkDrawer(props:SubtaskWorkDrawerProps){
 const controller=useWorkTree(props.parentTask!.id);
 return <SupportedSubtaskWorkDrawer {...props} controller={controller}/>;
}
function SupportedSubtaskWorkDrawer(props:SubtaskWorkDrawerProps&{controller:WorkTreeController}){
 const {user}=useAuth(),controller=props.controller;
 // This compatibility handoff requires the current owner's checked missing-RPC
 // result. Stale actor/root state and all other failures stay in the Inspector.
 if(user?.id&&controller.actorId===user.id&&controller.rootId===props.parentTask!.id&&props.subtask!.taskId===controller.rootId&&controller.unavailable)
  return <LegacySubtaskWorkDrawer {...props}/>;
 return <SubitemInspector rootTask={props.parentTask!} itemId={props.subtask!.id} readOnly={props.readOnly}
  canManageDeadline={props.canManageDeadline} currentReviewerId={props.currentReviewerId} prerequisite={props.prerequisite}
  controller={props.controller} origin={props.origin} initialSection={props.initialSection} executionBlocked={props.executionBlocked} onClose={props.onClose} onChanged={props.onChanged}/>;
}
