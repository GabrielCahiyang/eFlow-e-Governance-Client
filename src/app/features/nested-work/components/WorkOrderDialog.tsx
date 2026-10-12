import type {WorkTreeSnapshot} from '../types';

export function WorkOrderDialog({data,order,disabled,onChange}:{data:WorkTreeSnapshot;order:string[];disabled:boolean;onChange:(order:string[])=>void}){
 const move=(index:number,offset:number)=>{const next=[...order];[next[index],next[index+offset]]=[next[index+offset],next[index]];onChange(next);};
 return <ol aria-label="Subitem sequence">{order.map((id,index)=>{
  const title=data.nodes.find(node=>node.id===id)?.title||'Unavailable subitem';
  return <li key={id}>{title}
   <button type="button" aria-label={`Move up ${title}`} disabled={disabled||index===0} onClick={()=>move(index,-1)}>Move up</button>
   <button type="button" aria-label={`Move down ${title}`} disabled={disabled||index===order.length-1} onClick={()=>move(index,1)}>Move down</button>
  </li>;
 })}</ol>;
}
