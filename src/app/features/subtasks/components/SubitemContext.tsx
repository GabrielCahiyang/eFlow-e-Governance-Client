import {buildWorkDisplayTree,type WorkNode,type WorkTreeSnapshot} from '../../nested-work';
import {formatDate,ProgressBar} from '../../../components/workflow/primitives';

/** Uses only permitted snapshot names and canonical path edges. */
export function SubitemContext({node,tree,rootTitle,onOpenItem,onClose}:{node:WorkNode;tree:WorkTreeSnapshot;rootTitle:string;onOpenItem:(id:string)=>void;onClose:()=>void}){
 const row=buildWorkDisplayTree(tree.nodes).find(row=>row.id===node.id);
 const name=(id:string|null)=>id?tree.people.find(person=>person.id===id)?.name||'Person unavailable':'Unappointed';
 const parent=node.parent_subtask_id?tree.nodes.find(item=>item.id===node.parent_subtask_id):undefined;
 const children=tree.nodes.filter(item=>item.parent_subtask_id===node.id);
 return <header className="border-b border-neutral-100 p-4 space-y-3">
  <div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words text-base font-semibold">{node.title}</h2><button type="button" aria-label="Close subtask detail" onClick={onClose}>Close</button></div>
  <p>{node.status.replace(/_/g,' ')} · {node.percent_complete}%</p>
  <ProgressBar value={node.percent_complete} tone={node.status==='completed'?'good':'neutral'}/>
  <nav aria-label="Subitem path" className="break-words">
   {rootTitle}{row?.context||row?.pathTruncated?' / Parent context unavailable':''}
   {row?.path.map(part=><span key={part.id}> / {part.id===node.id?<span aria-current="page">{part.title}</span>:<button type="button" onClick={()=>onOpenItem(part.id)}>{part.title}</button>}</span>)}
  </nav>
  <dl className="space-y-2 text-sm">
   <div><dt>Subitem Lead</dt><dd>{name(node.lead_id)}</dd></div>
   <div><dt>Contributors</dt><dd>{node.assigned_to_ids.map(id=>name(id)).join(', ')||'No contributors'}</dd></div>
   <div><dt>Parent</dt><dd>{parent?<button type="button" onClick={()=>onOpenItem(parent.id)}>{parent.title}</button>:node.parent_subtask_id?'Parent unavailable':rootTitle}</dd></div>
   <div><dt>Children</dt><dd>{children.length}</dd></div>
   <div><dt>Subitem due date</dt><dd>{formatDate(node.due_date||undefined)}</dd></div>
   <div><dt>Execution mode</dt><dd>{node.is_standalone?'Can start independently':'Work in sequence'}</dd></div>
  </dl>
 </header>;
}
