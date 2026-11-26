import {Heading} from '@vibe/core';
import {buildWorkDisplayTree,type WorkNode,type WorkTreeSnapshot} from '../../nested-work';
import {DeadlineBadge} from '../../../components/ui/DeadlineBadge';
import {TaskStatusLabel} from '../../tasks/presentation/TaskStatusLabel';
import {ArrowLeft,GitBranch,ListOrdered,UserRound,UsersRound} from 'lucide-react';

function personInitials(label:string):string{
 return label.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
}

export function SubitemContext({node,tree,rootTitle,onOpenItem,onClose,stuck=false,dialog=false}:{stuck?:boolean;dialog?:boolean;node:WorkNode;tree:WorkTreeSnapshot;rootTitle:string;onOpenItem:(id:string)=>void;onClose:()=>void}){
 const effectiveStatus=stuck?'stuck':(node.effective_status??node.status);
 const row=buildWorkDisplayTree(tree.nodes).find(row=>row.id===node.id);
 const name=(id:string|null)=>id?tree.people.find(person=>person.id===id)?.name||'Person unavailable':'Needs a lead';
 const leadName=name(node.lead_id);
 const contributors=node.assigned_to_ids.filter(id=>id!==node.lead_id);
 const contributorText=contributors.length?contributors.map(id=>name(id)).join(', '):'No contributors';
 return <header className={dialog?'subitem-page-header subitem-page-header--dialog':'subitem-page-header'}>
  {!dialog&&<button type="button" className="task-page__back" onClick={onClose}><ArrowLeft size={16}/> Back to work</button>}
  <nav aria-label="Subtask path" className="subitem-breadcrumb">{rootTitle}{row?.context||row?.pathTruncated?' / Parent context unavailable':''}{row?.path.filter(part=>part.id!==node.id).map(part=><span key={part.id}> / <button onClick={()=>onOpenItem(part.id)}>{part.title}</button></span>)}</nav>
  <div className="subitem-title-row">
    <Heading type="h1">{node.title}</Heading>
    <TaskStatusLabel status={effectiveStatus} customStatusId={node.custom_status_id ?? undefined} />
  </div>
  <div className="subitem-meta" aria-label="Subtask summary">
   <span className={node.lead_id?'subitem-meta__chip subitem-meta__chip--lead':'subitem-meta__chip subitem-meta__chip--warn'}>
    {node.lead_id
     ?<span className="subitem-meta__avatar" aria-hidden="true">{personInitials(leadName)}</span>
     :<UserRound size={13} aria-hidden="true"/>}
    <span className="subitem-meta__label">Lead</span>
    <span className="subitem-meta__value">{leadName}</span>
   </span>
   <span className={contributors.length?'subitem-meta__chip':'subitem-meta__chip subitem-meta__chip--muted'}>
    <UsersRound size={13} aria-hidden="true"/>
    <span className="subitem-meta__value">{contributorText}</span>
   </span>
   {node.due_date&&(
    <span className="subitem-meta__chip subitem-meta__chip--date">
     <DeadlineBadge value={node.due_date} status={node.status}/>
    </span>
   )}
   <span className="subitem-meta__chip subitem-meta__chip--muted">
    {node.is_standalone?<GitBranch size={13} aria-hidden="true"/>:<ListOrdered size={13} aria-hidden="true"/>}
    <span>{node.is_standalone?'Independent step':'Sequential step'}</span>
   </span>
  </div>
 </header>;
}
