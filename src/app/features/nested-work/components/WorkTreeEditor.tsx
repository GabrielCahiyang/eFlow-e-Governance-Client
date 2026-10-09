import {useRef,useState} from 'react';
import {useExplicitDraft} from '../../../shared/useExplicitDraft';
import {requestNavigation} from '../../../shared/navigationGuard';
import {useConfirmation} from '../../../components/ui/useConfirmation';
import {WorkPeoplePicker} from './WorkPeoplePicker';
import {descendantIds,reparentChoices} from '../selectors/tree';
import type {WorkCommand,WorkNode,WorkRequest,WorkTreeSnapshot} from '../types';
export interface WorkEdit {command:WorkCommand;node?:WorkNode;parent?:string|null;root?:boolean}
export function WorkTreeEditor({data,edit,save,onDone,onCancel}:{data:WorkTreeSnapshot;edit:WorkEdit;save:(request:WorkRequest)=>Promise<WorkTreeSnapshot>;onDone:()=>void;onCancel:()=>void}){
 const node=edit.node,initialLead=edit.root?data.root.lead||'':node?.lead_id||'';
 const initialPeople=edit.root?[...new Set([data.root.lead,...data.root.people].filter((id):id is string=>!!id))]:node?.assigned_to_ids||[];
 const [title,setTitle]=useState(node?.title||''),[due,setDue]=useState(node?.due_date||(edit.parent?data.nodes.find(n=>n.id===edit.parent)?.due_date:null)||data.root.due||''),[lead,setLead]=useState(initialLead),[people,setPeople]=useState(initialPeople);
 const [parent,setParent]=useState(node?.parent_subtask_id||edit.parent||''),[standalone,setStandalone]=useState(node?.is_standalone||false),[note,setNote]=useState(''),[progress,setProgress]=useState(node?.percent_complete||0);
 const [order,setOrder]=useState(()=>data.nodes.filter(n=>n.parent_subtask_id===(edit.parent||null)).sort((a,b)=>a.sibling_order-b.sibling_order||a.id.localeCompare(b.id)).map(n=>n.id));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const request=useRef<WorkRequest | undefined>(undefined),createdId=useRef(crypto.randomUUID());
 const baselineRevision=useRef(data.revision);
 const confirmation=useConfirmation();
 const dirty=edit.command!=='staff'||title!==(node?.title||'')||lead!==initialLead||JSON.stringify(people)!==JSON.stringify(initialPeople)||!!note;
 const guard=useExplicitDraft('Nested work changes',dirty,busy,onCancel);
 const close=()=>void requestNavigation(onCancel);
 async function submit(){
  if(guard.pendingRef.current||!authorized)return;guard.pendingRef.current=true;setBusy(true);setError('');
  try{
   if(edit.command==='delete'&&!await confirmation.confirm({title:'Delete untouched subtree?',description:'Started work, evidence, progress, budget and cash histories prevent deletion. The server checks the entire subtree again.',actionLabel:'Delete subtree',danger:true,impact:<p>{1+descendantIds(data.nodes,node!.id).size} subitems will be removed. Cancel makes no changes.</p>}))return;
   let command=edit.command;let payload:Record<string,unknown>={id:node?.id};
   if(edit.root){command=data.can_transfer&&lead!==initialLead?'root_lead':'contributors';payload=command==='root_lead'?{lead,people}:{people};}
   else if(command==='create')payload={id:createdId.current,title,parent:edit.parent||null,lead:lead||null,people,due:due||null,standalone};
   else if(command==='staff')payload={id:node!.id,lead,people};
   else if(command==='edit')payload={id:node!.id,title,due:due||null,standalone,note};
   else if(command==='move')payload={id:node!.id,parent:parent||null};
   else if(command==='order')payload={parent:edit.parent||null,order};
   else if(command==='progress')payload={id:node!.id,progress,note};
   else if(command==='submit')payload={id:node!.id,note};
   else if(command==='review')payload={id:node!.id,approve:progress===100,note};
   if(!request.current)request.current={id:crypto.randomUUID(),revision:baselineRevision.current,command,payload};
   await save(request.current);guard.markClean();onDone();
  }catch(reason){setError(reason instanceof Error?reason.message:'Could not save; retry the same request.');}
  finally{guard.pendingRef.current=false;setBusy(false);}
 }
 const current=node?data.nodes.find(n=>n.id===node.id):undefined;
 const authorized=edit.root?data.can_manage:edit.command==='create'?(edit.parent?data.nodes.find(n=>n.id===edit.parent)?.can_manage:data.can_manage):edit.command==='order'?(edit.parent?data.nodes.find(n=>n.id===edit.parent)?.can_manage:data.can_manage):['progress','submit'].includes(edit.command)?current?.can_work:edit.command==='review'?current?.can_review:current?.can_manage;
 const locked=busy||!!request.current;
 return <form className="r7-form" aria-label="Nested work changes" onSubmit={e=>{e.preventDefault();void submit();}}>
  <h3>{edit.root?'Task lead and contributors':`${edit.command==='create'?'Add child':edit.command==='staff'?'Staff':edit.command==='move'?'Move':edit.command==='delete'?'Delete':edit.command==='review'?'Review':'Update'} ${node?.title||'subitem'}`}</h3>
  {['create','edit'].includes(edit.command)&&<><label>Subitem title<input value={title} maxLength={200} required disabled={locked} onChange={e=>setTitle(e.target.value)}/></label><label>Subitem due date<input type="date" value={due} max={edit.parent?data.nodes.find(n=>n.id===edit.parent)?.due_date||data.root.due||undefined:data.root.due||undefined} disabled={locked} onChange={e=>setDue(e.target.value)}/></label><label><input type="checkbox" checked={standalone} disabled={locked} onChange={e=>setStandalone(e.target.checked)}/>Standalone · runs independently of earlier siblings</label></>}
  {['staff','create'].includes(edit.command)&&<WorkPeoplePicker invite={{project:data.root.project,office:data.root.office,root:data.root.id,node:node?.id||edit.parent||undefined}} people={data.people} lead={lead} selected={people} onLead={setLead} onSelected={setPeople} canAppoint={edit.root?data.can_transfer:edit.command==='create'||!!node?.can_appoint} disabled={locked}/>}
  {edit.command==='move'&&<label>Destination parent<select value={parent} disabled={locked} onChange={e=>setParent(e.target.value)}>{data.can_manage&&<option value="">Root task</option>}{reparentChoices(data.nodes,node!).map(n=><option key={n.id} value={n.id}>{n.title} · depth {n.depth}</option>)}</select></label>}
  {edit.command==='order'&&<ol>{order.map((id,index)=><li key={id}>{data.nodes.find(n=>n.id===id)?.title}<button type="button" disabled={locked||index===0} onClick={()=>setOrder(ids=>{const next=[...ids];[next[index-1],next[index]]=[next[index],next[index-1]];return next;})}>Move up</button><button type="button" disabled={locked||index===order.length-1} onClick={()=>setOrder(ids=>{const next=[...ids];[next[index+1],next[index]]=[next[index],next[index+1]];return next;})}>Move down</button></li>)}</ol>}
  {edit.command==='progress'&&<label>Progress<input type="number" min={0} max={99} value={progress} disabled={locked} onChange={e=>setProgress(Number(e.target.value))}/></label>}
  {edit.command==='review'&&<label>Decision<select value={progress===100?'approve':'reject'} disabled={locked} onChange={e=>setProgress(e.target.value==='approve'?100:99)}><option value="approve">Approve personal work</option><option value="reject">Return for changes</option></select></label>}
  {['edit','progress','submit','review'].includes(edit.command)&&<label>{edit.command==='edit'?'Reason for date change':'Note / feedback'}<textarea value={note} maxLength={4000} disabled={locked} onChange={e=>setNote(e.target.value)}/></label>}
  {error&&<p role="alert">{error} The original request is retained for safe retry. Reopen only after verifying the current tree.</p>}
  <div className="r7-actions"><button type="button" disabled={busy} onClick={close}>Cancel changes</button>{!authorized&&<p role="alert">Your current branch authority changed. Reload the tree before saving.</p>}<button type="submit" disabled={busy||!authorized}>{busy?'Saving…':request.current?'Retry saved request':edit.command==='delete'?'Review deletion':'Save work changes'}</button></div>
  {confirmation.dialog}
 </form>;
}
