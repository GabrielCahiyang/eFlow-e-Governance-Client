import {useState,type ReactNode} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {useWorkTree} from '../hooks/useWorkTree';
import {WorkStaffingDialog} from './WorkStaffingDialog';
import {WorkPeopleSummary} from './WorkPeopleSummary';
import {isCurrentWorkSnapshot,selectRootWorkCapability} from '../selectors/capabilities';
import type {WorkTreeController} from '../types';
import '../nestedWork.css';
import {readWorkDrafts} from '../services/workDraftStore';
export interface WorkRootOwnerProps {rootId:string;controller?:WorkTreeController;fallback?:ReactNode;readOnly?:boolean}
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
function WorkRootOwnerContent({rootId,fallback,readOnly=false,tree}:WorkRootOwnerProps & {tree:WorkTreeController}){
 const {user}=useAuth();
 const [open,setOpen]=useState(false),[saved,setSaved]=useState('');
 if(tree.unavailable)return <>{fallback}</>;
 if(tree.loading&&!tree.data)return <div className="r7-work r7-root-owner" role="status">Loading project people…</div>;
 const data=tree.data;if(!data)return tree.error?<div className="r7-work r7-root-owner" role="alert">{tree.error}<button type="button" onClick={()=>void tree.reload()}>Retry project people</button></div>:null;
 const context={actorId:user?.id||null,rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,readOnly};
 const canStaff=selectRootWorkCapability(data,'manage_contributors',context).allowed||selectRootWorkCapability(data,'appoint_lead',context).allowed;
 const recoverable=tree.authorityFresh&&readWorkDrafts(data,context).some(record=>record.mode==='staffing'&&!record.baseline.nodeId);
 return <div className="r7-work r7-root-owner"><WorkPeopleSummary leadId={data.root.lead} contributorIds={data.root.people} people={data.people} compact/>
  {tree.error&&<p role="alert">{tree.error}<button type="button" onClick={()=>void tree.reload()}>Retry project people</button></p>}
  {canStaff&&<button type="button" aria-label="Choose task lead and contributors" disabled={tree.loading||tree.pending||!tree.authorityFresh} onClick={()=>setOpen(true)}>{recoverable?'Recover people draft':'Choose people'}</button>}
  {saved&&<p role="status">{saved}</p>}
  {open&&<WorkStaffingDialog controller={tree} nodeId={null} readOnly={readOnly}
   onChanged={()=>{setOpen(false);setSaved('Task people saved.');}} onClose={()=>{setOpen(false);void tree.reload();}}/>}
 </div>;
}
