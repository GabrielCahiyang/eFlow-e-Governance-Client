import {useState,type ReactNode} from 'react';
import {UsersRound} from 'lucide-react';
import {useAuth} from '../../../contexts/AuthContext';
import {useWorkTree} from '../hooks/useWorkTree';
import {WorkStaffingDialog} from './WorkStaffingDialog';
import {WorkPeopleSummary} from './WorkPeopleSummary';
import {collectSubtaskTeamIds,resolveWorkPersonName} from '../selectors/people';
import {isCurrentWorkSnapshot,selectRootWorkCapability} from '../selectors/capabilities';
import type {WorkTreeController} from '../types';
import '../nestedWork.css';
import {readWorkDrafts} from '../services/workDraftStore';
export interface WorkRootOwnerProps {rootId:string;controller?:WorkTreeController;fallback?:ReactNode;readOnly?:boolean;layout?:'default'|'inline'|'table'}
export function WorkRootOwner(props:WorkRootOwnerProps){
 const {user}=useAuth(),key=JSON.stringify([user?.id,props.rootId]);
 if(props.controller){
  if(props.controller.rootId!==props.rootId||props.controller.actorId!==(user?.id||null)||props.controller.data&&props.controller.data.root.id!==props.rootId)return <>{props.fallback}</>;
  const data=props.controller.data;
  if(data&&!isCurrentWorkSnapshot(data,{actorId:props.controller.actorId,rootId:props.rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision}))return <>{props.fallback}</>;
  return <WorkRootOwnerContent key={key} {...props} tree={props.controller}/>;
 }
 return <ConnectedWorkRootOwner key={key} {...props}/>;
}
function ConnectedWorkRootOwner(props:WorkRootOwnerProps){const tree=useWorkTree(props.rootId);return <WorkRootOwnerContent {...props} tree={tree}/>;}
function WorkRootOwnerContent({rootId,fallback,readOnly=false,tree,layout='default'}:WorkRootOwnerProps & {tree:WorkTreeController}){
 const {user}=useAuth();
 const [open,setOpen]=useState(false),[saved,setSaved]=useState('');
 if(tree.unavailable)return <>{fallback}</>;
 if(tree.loading&&!tree.data)return <div className="r7-work r7-root-owner" role="status">Loading project people…</div>;
 const data=tree.data;if(!data)return tree.error?<div className="r7-work r7-root-owner" role="alert">{tree.error}<button type="button" onClick={()=>void tree.reload()}>Retry project people</button></div>:null;
 const context={actorId:user?.id||null,rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,readOnly};
 const contributorAccess=selectRootWorkCapability(data,'manage_contributors',context),appointmentAccess=selectRootWorkCapability(data,'appoint_lead',context);
 const canStaff=contributorAccess.allowed||appointmentAccess.allowed;
 const recoverable=tree.authorityFresh&&readWorkDrafts(data,context).some(record=>record.mode==='staffing'&&!record.baseline.nodeId&&!!record.request);
 const team=collectSubtaskTeamIds(data.root.lead,data.root.people,data.nodes);
 const leadName=data.root.lead?resolveWorkPersonName(data.people,data.root.lead):'Needs reassignment';
 const teamNames=team.teamIds.map(id=>resolveWorkPersonName(data.people,id));
 const teamTooltip=[
  `Lead: ${leadName}`,
  team.directIds.length?`Contributors (${team.directIds.length}): ${team.directIds.map(id=>resolveWorkPersonName(data.people,id)).join(', ')}`:null,
  team.subtaskIds.length?`Subtask team (${team.subtaskIds.length}): ${team.subtaskIds.map(id=>resolveWorkPersonName(data.people,id)).join(', ')}`:null,
 ].filter(Boolean).join(' · ');
 return <div className={`r7-work r7-root-owner${layout==='inline'?' r7-root-owner--inline':layout==='table'?' r7-root-owner--table':''}`}>
  {layout==='table'
   ? <div className="r7-owner-summary" title={teamTooltip}>
    <div className="r7-owner-lead">
     <span className="r7-owner-role">Lead</span>
     <span className={`r7-owner-name${!data.root.lead?' r7-owner-name--missing':''}`}>{leadName}</span>
    </div>
    <div className="r7-owner-team">
     {teamNames.length>0
      ? <>+{teamNames.length} · {teamNames.join(', ')}</>
      : 'Lead only'}
    </div>
   </div>
   : <WorkPeopleSummary leadId={data.root.lead} contributorIds={data.root.people} people={data.people} compact/>}
  {tree.error&&<p role="alert">{tree.error}<button type="button" onClick={()=>void tree.reload()}>Retry project people</button></p>}
  {tree.refreshPending&&<span role="status" className="r7-help">Checking current access…</span>}
  {contributorAccess.reason_code==='active_staffing_locked'&&<p className="r7-help" role="status">{contributorAccess.disabledReason}</p>}
  {canStaff&&<button type="button" className={layout==='table'?'r7-owner-edit':undefined} aria-label="Choose task lead and contributors" disabled={tree.loading||tree.pending||!tree.authorityFresh} onClick={()=>setOpen(true)}>{(layout==='inline'||layout==='table')&&<UsersRound size={13} aria-hidden="true"/>}<span>{recoverable?'Recover people draft':layout==='inline'?'Manage people':'Choose people'}</span></button>}
  {saved&&<p role="status">{saved}</p>}
  {open&&<WorkStaffingDialog controller={tree} nodeId={null} readOnly={readOnly}
   onChanged={()=>{setOpen(false);setSaved('Task people saved.');}} onClose={()=>{setOpen(false);void tree.reload();}}/>}
 </div>;
}
