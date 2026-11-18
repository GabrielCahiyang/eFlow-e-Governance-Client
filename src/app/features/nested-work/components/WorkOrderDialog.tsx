import type {WorkTreeSnapshot} from '../types';

export function WorkOrderDialog({data,order,disabled,onChange}:{data:WorkTreeSnapshot;order:string[];disabled:boolean;onChange:(order:string[])=>void}){
 const move=(index:number,offset:number)=>{const next=[...order];[next[index],next[index+offset]]=[next[index+offset],next[index]];onChange(next);};
 return <ol aria-label="Subtask sequence" className="m-0 list-none space-y-2 p-0">{order.map((id,index)=>{
  const title=data.nodes.find(node=>node.id===id)?.title||'Unavailable subtask';
  return <li key={id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-surface,#fff)] px-3 py-2">
   <span className="min-w-0 flex-1 break-words text-[13px] font-medium text-[var(--eflow-text,#161b35)]">{index+1}. {title}</span>
   <span className="flex shrink-0 items-center gap-1.5">
    <button type="button" aria-label={`Move up ${title}`} disabled={disabled||index===0} onClick={()=>move(index,-1)}>Move up</button>
    <button type="button" aria-label={`Move down ${title}`} disabled={disabled||index===order.length-1} onClick={()=>move(index,1)}>Move down</button>
   </span>
  </li>;
 })}</ol>;
}
