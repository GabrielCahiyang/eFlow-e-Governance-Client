import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {useWorkTree} from '../hooks/useWorkTree';
import {WorkTreeEditor,type WorkEdit} from './WorkTreeEditor';
import type {WorkNode,WorkRequest,WorkTreeSnapshot} from '../types';
import '../nestedWork.css';
export function WorkTree(props:{rootId:string;fallback?:ReactNode;readOnly?:boolean;focusedNodeId?:string;onOpenOfficeNode?:(node:WorkNode,tree:WorkTreeSnapshot)=>void;onReviewOfficeNode?:(node:WorkNode,tree:WorkTreeSnapshot)=>void}){
 const {user}=useAuth();return <WorkTreeContent key={`${user?.id}:${props.rootId}`} {...props}/>;
}
function WorkTreeContent({rootId,fallback,readOnly=false,focusedNodeId,onOpenOfficeNode,onReviewOfficeNode}:{rootId:string;fallback?:ReactNode;readOnly?:boolean;focusedNodeId?:string;onOpenOfficeNode?:(node:WorkNode,tree:WorkTreeSnapshot)=>void;onReviewOfficeNode?:(node:WorkNode,tree:WorkTreeSnapshot)=>void}){
 const tree=useWorkTree(rootId);const [edit,setEdit]=useState<WorkEdit>(),[saved,setSaved]=useState('');tree.hold.current=!!edit;
 const section=useRef<HTMLElement>(null),scrolled=useRef<string|undefined>(undefined);
 useEffect(()=>{if(focusedNodeId&&tree.data&&scrolled.current!==focusedNodeId){section.current?.querySelector<HTMLElement>('[data-selected-work="true"]')?.scrollIntoView({block:'nearest'});scrolled.current=focusedNodeId;}},[focusedNodeId,tree.data]);
 if(tree.unavailable)return <>{fallback}</>;
 const data=tree.data;
 const save=async(request:WorkRequest)=>{const result=await tree.save(request);setSaved('Work saved.');return result;};
 return <section ref={section} className="r7-work" aria-label="Nested project work"><h3>Subitems</h3><p className="r7-help">Up to 8 levels. Ordered work waits for earlier siblings; every descendant requires its applicable review.</p>
  {tree.loading&&<p role="status">Loading nested work…</p>}{tree.error&&<p role="alert">{tree.error}<button type="button" onClick={()=>void tree.reload()}>Retry nested work</button></p>}{saved&&<p role="status">{saved}</p>}
  {data&&<><p>Descendant leaves: {data.leaf_completed}/{data.leaf_total} approved · Manual task progress is separate.</p>
   {!readOnly&&data.can_manage&&!edit&&<button type="button" onClick={()=>setEdit({command:'create'})}>Add root subitem</button>}
   {data.nodes.map(node=><article key={node.id} className="r7-node" data-selected-work={node.id===focusedNodeId||undefined} style={{marginLeft:Math.min(node.depth-1,3)*8}} aria-label={`Subitem ${node.title}`}>
    <div className="r7-title"><strong>{node.title}</strong><span className="r7-depth">Depth {node.depth}{node.parent_subtask_id?` · Under ${data.nodes.find(n=>n.id===node.parent_subtask_id)?.title||'ancestor'}`:''}</span></div>
    <p>{!node.lead_id&&node.status!=='completed'&&<small>Needs reassignment · </small>}Lead: {data.people.find(p=>p.id===node.lead_id)?.name||'Needs appointment'} · {node.status.replace('_',' ')} · {node.percent_complete}%{node.due_date?` · Due ${node.due_date}`:''}</p>
    <p className="r7-help">{node.is_standalone?'Standalone':'Ordered sibling'} · {node.assigned_to_ids.map(id=>data.people.find(p=>p.id===id)?.name||'Previously assigned person').join(', ')||'Unassigned'}</p>
    <div className="r7-actions">{data.root.kind==='office'&&onOpenOfficeNode&&<button type="button" onClick={()=>onOpenOfficeNode(node,data)}>Open work / evidence</button>}
     {!readOnly&&!edit&&node.can_order&&node.status==='todo'&&<button type="button" onClick={()=>setEdit({command:'order',parent:node.parent_subtask_id})}>Order siblings of {node.title}</button>}
     {!readOnly&&!edit&&node.can_manage&&node.status!=='completed'&&<button type="button" onClick={()=>setEdit({command:'staff',node})}>Staff {node.title}</button>}
     {!readOnly&&!edit&&node.can_manage&&node.status==='todo'&&<><button type="button" onClick={()=>setEdit({command:'edit',node})}>Edit {node.title}</button>{node.depth<8&&<button type="button" onClick={()=>setEdit({command:'create',parent:node.id})}>Add child to {node.title}</button>}<button type="button" onClick={()=>setEdit({command:'move',node})}>Move {node.title}</button><button type="button" onClick={()=>setEdit({command:'delete',node})}>Delete subtree {node.title}</button></>}
     {!readOnly&&!edit&&data.root.kind==='personal'&&node.can_work&&!['completed','for_review'].includes(node.status)&&<><button type="button" onClick={()=>setEdit({command:'progress',node})}>Progress {node.title}</button><button type="button" onClick={()=>setEdit({command:'submit',node})}>Submit {node.title}</button></>}
     {!readOnly&&!edit&&node.can_review&&(data.root.kind==='personal'?<button type="button" onClick={()=>setEdit({command:'review',node})}>Review {node.title}</button>:onReviewOfficeNode&&<button type="button" onClick={()=>onReviewOfficeNode(node,data)}>Review {node.title}</button>)}
    </div>
   </article>)}
   {edit&&<WorkTreeEditor key={`${edit.command}:${edit.node?.id}:${edit.parent}`} data={data} edit={edit} save={save} onDone={()=>setEdit(undefined)} onCancel={()=>{setEdit(undefined);void tree.reload();}}/>}
  </>}
 </section>;
}
