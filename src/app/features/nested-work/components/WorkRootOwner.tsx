import {useState,type ReactNode} from 'react';
import {HelpCircle, UsersRound} from 'lucide-react';
import {WorkspacePopover, WorkspaceTooltip} from '../../../components/ui/workspace';
import {useAuth} from '../../../contexts/AuthContext';
import {useWorkTree} from '../hooks/useWorkTree';
import {WorkStaffingDialog} from './WorkStaffingDialog';
import {WorkPeopleSummary} from './WorkPeopleSummary';
import {OwnerAvatarStack} from './OwnerAvatarStack';
import {collectSubtaskTeamIds,resolveWorkPersonName} from '../selectors/people';
import {isCurrentWorkSnapshot,selectRootWorkCapability} from '../selectors/capabilities';
import type {WorkTreeController} from '../types';
import '../nestedWork.css';
import {readWorkDrafts} from '../services/workDraftStore';
export interface WorkRootOwnerProps {rootId:string;controller?:WorkTreeController;fallback?:ReactNode;readOnly?:boolean;layout?:'default'|'inline'|'table';projectLeadId?:string|null}
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
function WorkRootOwnerContent({rootId,fallback,readOnly=false,tree,layout='default',projectLeadId}:WorkRootOwnerProps & {tree:WorkTreeController}){
 const {user}=useAuth();
 const [open,setOpen]=useState(false),[saved,setSaved]=useState('');
 if(tree.unavailable)return <>{fallback}</>;
 if(tree.loading&&!tree.data)return <div className="r7-work r7-root-owner" role="status">Loading team…</div>;
 const data=tree.data;if(!data)return tree.error?<div className="r7-work r7-root-owner flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert"><span>{tree.error}</span><button type="button" className="shrink-0 rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100" onClick={()=>void tree.reload()}>Retry</button></div>:null;
 const context={actorId:user?.id||null,rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,readOnly};
 const contributorAccess=selectRootWorkCapability(data,'manage_contributors',context),appointmentAccess=selectRootWorkCapability(data,'appoint_lead',context);
 const canStaff=contributorAccess.allowed||appointmentAccess.allowed;
 const recoverable=tree.authorityFresh&&readWorkDrafts(data,context).some(record=>record.mode==='staffing'&&!record.baseline.nodeId&&!!record.request);
 const team=collectSubtaskTeamIds(data.root.lead,data.root.people,data.nodes);
 const leadName=data.root.lead?resolveWorkPersonName(data.people,data.root.lead):'Needs reassignment';
 const teamNames=team.teamIds.map(id=>resolveWorkPersonName(data.people,id));
 return <div className={`r7-work r7-root-owner${layout==='inline'?' r7-root-owner--inline':layout==='table'?' r7-root-owner--table':''}`}>
  {layout==='table'
   ? canStaff
    ? <button
     type="button"
     className="r7-owner-trigger"
     aria-label={data.root.lead ? `Edit owner: ${leadName}` : 'Assign task owner'}
     disabled={tree.loading||tree.pending||!tree.authorityFresh}
     onClick={()=>setOpen(true)}
    >
     <OwnerAvatarStack
      leadName={leadName}
      hasLead={!!data.root.lead}
      memberNames={teamNames}
      focusableAvatars={false}
      srSummary={<><span>{leadName}</span><span>{teamNames.length>0?`+${teamNames.length} · ${teamNames.join(', ')}`:'Lead only'}</span></>}
     />
    </button>
    : <OwnerAvatarStack
     leadName={leadName}
     hasLead={!!data.root.lead}
     memberNames={teamNames}
     srSummary={<><span>{leadName}</span><span>{teamNames.length>0?`+${teamNames.length} · ${teamNames.join(', ')}`:'Lead only'}</span></>}
    />
   : <WorkPeopleSummary leadId={data.root.lead} contributorIds={data.root.people} people={data.people} compact/>}
  {tree.error&&<p className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800" role="alert"><span>{tree.error}</span><button type="button" className="shrink-0 rounded-md border border-rose-300 bg-white px-2 py-0.5 text-xs font-medium text-rose-800 hover:bg-rose-100" onClick={()=>void tree.reload()}>Retry</button></p>}
  {tree.refreshPending&&<span role="status" className={layout!=='default'?'sr-only':'r7-help'}>Checking current access…</span>}
  {contributorAccess.reason_code==='active_staffing_locked'&&(layout==='table'
   ? <WorkspacePopover
    collisionPadding={16}
    trigger={
     <button
      type="button"
      className="r7-owner-edit r7-owner-edit--icon"
      aria-label="Team access info"
      title={contributorAccess.disabledReason || undefined}
     >
      <HelpCircle size={14} aria-hidden="true"/>
     </button>
    }
   >
    <div className="max-w-[260px] space-y-1 text-xs leading-relaxed text-[var(--eflow-text-secondary)]">
     <p className="font-semibold text-[var(--eflow-text)]">Active project team access</p>
     <p role="status">{contributorAccess.disabledReason}</p>
    </div>
   </WorkspacePopover>
   : <p className="r7-help" role="status">{contributorAccess.disabledReason}</p>)}
  {canStaff&&(layout==='table'
   ? <WorkspaceTooltip content={recoverable?'Recover people draft':'Choose people'}>
    <button type="button" className="r7-owner-edit r7-owner-edit--icon" aria-label="Choose task lead and contributors" disabled={tree.loading||tree.pending||!tree.authorityFresh} onClick={()=>setOpen(true)}>
     <UsersRound size={14} aria-hidden="true"/><span className="sr-only">{recoverable?'Recover people draft':'Choose people'}</span>
    </button>
   </WorkspaceTooltip>
   : <button type="button" aria-label="Choose task lead and contributors" disabled={tree.loading||tree.pending||!tree.authorityFresh} onClick={()=>setOpen(true)}>
    {layout==='inline'&&<UsersRound size={13} aria-hidden="true"/>}<span>{recoverable?'Recover people draft':layout==='inline'?'Manage people':'Choose people'}</span>
   </button>)}
  {saved&&<p role="status">{saved}</p>}
  {open&&<WorkStaffingDialog controller={tree} nodeId={null} projectLeadId={projectLeadId} readOnly={readOnly}
   onChanged={()=>{setOpen(false);setSaved('Task people saved.');}} onClose={()=>{setOpen(false);void tree.reload();}}/>}
 </div>;
}
