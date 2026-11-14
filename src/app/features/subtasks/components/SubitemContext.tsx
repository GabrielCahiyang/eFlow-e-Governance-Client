import {buildWorkDisplayTree,type WorkNode,type WorkTreeSnapshot} from '../../nested-work';
import {DeadlineBadge} from '../../../components/ui/DeadlineBadge';
import {useWorkStatus} from '../../work-status';
import {workStateLabel} from '../../work-state';
import {ArrowLeft,UserRound,UsersRound} from 'lucide-react';
export function SubitemContext({node,tree,rootTitle,onOpenItem,onClose,stuck=false}:{stuck?:boolean;node:WorkNode;tree:WorkTreeSnapshot;rootTitle:string;onOpenItem:(id:string)=>void;onClose:()=>void}){
 const effectiveStatus=node.effective_status??node.status;
 const status=useWorkStatus(stuck?'stuck':effectiveStatus,workStateLabel(effectiveStatus,stuck),node.custom_status_id);
 const row=buildWorkDisplayTree(tree.nodes).find(row=>row.id===node.id);
 const name=(id:string|null)=>id?tree.people.find(person=>person.id===id)?.name||'Person unavailable':'Needs a lead';
 const contributors=node.assigned_to_ids.filter(id=>id!==node.lead_id);
 return <header className="subitem-page-header">
  <button type="button" className="task-page__back" onClick={onClose}><ArrowLeft size={16}/> Back to work</button>
  <nav aria-label="Subtask path" className="subitem-breadcrumb">{rootTitle}{row?.context||row?.pathTruncated?' / Parent context unavailable':''}{row?.path.filter(part=>part.id!==node.id).map(part=><span key={part.id}> / <button onClick={()=>onOpenItem(part.id)}>{part.title}</button></span>)}</nav>
  <div className="subitem-title-row"><h1>{node.title}</h1><span className="work-status-badge" style={status.color ? {boxShadow: `inset 3px 0 ${status.color}`} : undefined}>{status.label}</span></div>
  <div className="subitem-meta"><span><UserRound size={16}/> {name(node.lead_id)}</span><span><UsersRound size={16}/> {contributors.length?contributors.map(id=>name(id)).join(', '):'No contributors'}</span><DeadlineBadge value={node.due_date} status={node.status}/><span>{node.is_standalone?'Independent step':'Sequential step'}</span></div>
 </header>;
}
