import {useAuth} from '../../../contexts/AuthContext';
import {FeatureDialog} from '../../../components/ui/FeatureDialog';
import {useWorkTree} from '../hooks/useWorkTree';
import {WorkStaffingDialog} from './WorkStaffingDialog';
import type {WorkTreeSnapshot,WorkTreeController} from '../types';

interface Props {rootId:string;controller?:WorkTreeController;readOnly?:boolean;contributorsOnly?:boolean;preselectedLeadId?:string;onClose:()=>void;onChanged?:(receipt:WorkTreeSnapshot)=>void|Promise<void>}

/** Shared table owner when supplied; standalone compatibility owner otherwise. */
export function WorkRootStaffingDialog(props:Props) {
 const {user}=useAuth();
 return props.controller?<WorkRootStaffingDialogContent key={`${user?.id}:${props.rootId}`} {...props} tree={props.controller}/>:<ConnectedRootStaffingDialog key={`${user?.id}:${props.rootId}`} {...props}/>;
}
function ConnectedRootStaffingDialog(props:Props){const tree=useWorkTree(props.rootId);return <WorkRootStaffingDialogContent {...props} tree={tree}/>;}
function WorkRootStaffingDialogContent({rootId,readOnly=false,contributorsOnly=false,preselectedLeadId,onClose,onChanged,tree}:Props & {tree:WorkTreeController}) {
 if(tree.rootId!==rootId)return <FeatureDialog title="Task lead and contributors" onClose={onClose}><p role="alert">Verify current work access before choosing people.</p></FeatureDialog>;
 if(tree.data&&!tree.unavailable)return <><WorkStaffingDialog controller={tree}
  nodeId={null} readOnly={readOnly} contributorsOnly={contributorsOnly} preselectedLeadId={preselectedLeadId} onClose={onClose} onChanged={onChanged||onClose}/>
  {tree.error&&<p role="alert">{tree.error}<button type="button" onClick={()=>void tree.reload()}>Retry project people</button></p>}</>;
 return <FeatureDialog title="Task lead and contributors" onClose={onClose} contentClassName="max-w-lg">
  <div className="p-4">
   {tree.loading?<p role="status">Loading project people…</p>:<p role="alert">{tree.error||'Staffing is unavailable. Reopen from your project workspace.'}</p>}
   {!tree.loading&&<button type="button" onClick={()=>void tree.reload()}>Retry project people</button>}
   <button type="button" onClick={onClose}>Close people</button>
  </div>
 </FeatureDialog>;
}
