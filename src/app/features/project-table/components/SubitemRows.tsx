import { useState } from 'react';
import { CornerDownRight,Plus } from 'lucide-react';
import { InlineEditableText } from '../../../components/ui/workspace';
import { createSubtask,updateSubtask,type Subtask } from '../../subtasks';
import type { Task } from '../../tasks';
export function SubitemRows({task,subtasks,columns,canAdd,onOpen,refresh}:{task:Task;subtasks:Subtask[];columns:number;canAdd:boolean;onOpen:(s:Subtask)=>void;refresh:()=>Promise<void>}){
 const [title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function add(e:React.FormEvent){e.preventDefault();if(!title.trim()||busy)return;setBusy(true);setError('');try{await createSubtask(task.id,title.trim(),{position:Math.max(-1,...subtasks.map(s=>s.position))+1});setTitle('');await refresh();}catch(e){setError(e instanceof Error?e.message:'Could not add subitem.');}finally{setBusy(false);}}
 return <>{[...subtasks].sort((a,b)=>a.position-b.position).map(s=><tr className="pt-subitem" key={s.id}><td/><td><CornerDownRight size={14}/><InlineEditableText value={s.title} label={'subitem '+s.title} disabled={!canAdd||s.status==='completed'} onSave={async title=>{await updateSubtask(s.id,{title});await refresh();}}/></td><td colSpan={columns-2}><div className="pt-subitem-info"><button type="button" onClick={()=>onOpen(s)}>Open subitem · {s.status.replace(/_/g,' ')}</button><span>{s.percentComplete}%</span>{s.dueDate&&<span>{s.dueDate}</span>}</div></td></tr>)}
 {canAdd&&<tr className="pt-subitem"><td/><td colSpan={columns-1}><form onSubmit={add}><Plus size={14}/><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Add subitem" aria-label={'Add subitem to '+task.title} maxLength={200} disabled={busy}/><button disabled={!title.trim()||busy}>Add</button>{error&&<small role="alert">{error}</small>}</form></td></tr>}
 </>;
}

