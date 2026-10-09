import { useState } from 'react';
import { FormField, SelectInput } from '../../../components/ui/FormField';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import type { PersonalCommand, PersonalMember, PersonalTask } from '../types';
export function PersonalTaskStaffing({task,members,busy,run,onClose}:{task:PersonalTask;members:PersonalMember[];busy:boolean;run:(command:PersonalCommand,payload:Record<string,unknown>)=>Promise<boolean>;onClose:()=>void}){
 const [lead,setLead]=useState(task.lead_id||''),[reviewer,setReviewer]=useState(task.reviewer_id||'');
 const options=members.filter(m=>m.state==='active'&&m.eligible).map(m=>({value:m.user_id,label:m.name}));
 useNavigationBlocker({label:`Staffing ${task.title}`,identity:task.id,dirty:lead!==task.lead_id||reviewer!==(task.reviewer_id||''),pending:busy,onDiscard:onClose});
 return <form className="r3-members-form" onSubmit={async e=>{e.preventDefault();if(await run('staff_task',{task_id:task.id,revision:task.revision,lead_id:lead,reviewer_id:reviewer||null}))onClose();}}>
  <FormField label={`Lead for ${task.title}`}><SelectInput value={lead||''} disabled={busy} options={options} onChange={e=>{setLead(e.target.value);if(e.target.value===reviewer)setReviewer('');}}/></FormField>
  <FormField label={`Reviewer for ${task.title}`}><SelectInput value={reviewer} disabled={busy} options={[{value:'',label:task.reviewer_id?'Choose independent reviewer':'No review required'},...options.filter(p=>p.value!==lead)]} onChange={e=>setReviewer(e.target.value)}/></FormField>
  <p>Staffing reopens submitted work for a new submission. Required review remains mandatory.</p>
  <button type="submit" disabled={busy||!lead||Boolean(task.reviewer_id&&!reviewer)}>Save staffing</button><button type="button" disabled={busy} onClick={onClose}>Cancel staffing</button>
 </form>;
}
