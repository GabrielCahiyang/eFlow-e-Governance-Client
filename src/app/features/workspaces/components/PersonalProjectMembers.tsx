import {fetchAccess} from '../../project-access';
import { useEffect, useState } from 'react';
import { FormField, SelectInput } from '../../../components/ui/FormField';
import { fetchPersonalCandidates } from '../services/workspaceService';
import type { PersonalCommand, PersonalSnapshot } from '../types';

export function PersonalProjectMembers({data,busy,run}:{data:PersonalSnapshot;busy:boolean;run:(command:PersonalCommand,payload:Record<string,unknown>)=>Promise<boolean>}){
 const [reviewed,setReviewed]=useState(false);
 useEffect(()=>{let active=true;void fetchAccess(data.project.id).then(()=>{if(active)setReviewed(true);}).catch(()=>{});return()=>{active=false;};},[data.project.id]);
 const [candidates,setCandidates]=useState<{id:string;name:string}[]>([]),[selected,setSelected]=useState(''),[access,setAccess]=useState('member'),[error,setError]=useState('');
 useEffect(()=>{let active=true;fetchPersonalCandidates(data.project.id).then(rows=>{if(active)setCandidates(rows);}).catch(error=>{if(active)setError(error instanceof Error?error.message:'Could not load eligible people.');});return()=>{active=false;};},[data.project.id]);
 if(reviewed)return <p>Use Members and access terms above for recipient-bound sharing, explicit reapproval and reviewed removal.</p>;
 return <section aria-label="Personal project membership"><h2>Project access</h2><p>Choose already onboarded people in your own Office. Membership applies to this project; it does not grant workspace administration or Office authority.</p>
  {error&&<p role="alert">{error}</p>}
  <form className="r3-members-form" onSubmit={async e=>{e.preventDefault();if(selected&&await run('set_member',{user_id:selected,access,state:'active'}))setSelected('');}}>
   <FormField label="Person"><SelectInput value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)} options={[{value:'',label:'Choose person'},...candidates.filter(p=>p.id!==data.owner).map(p=>({value:p.id,label:p.name}))]}/></FormField>
   <FormField label="Project permission"><SelectInput value={access} disabled={busy} onChange={e=>setAccess(e.target.value)} options={[{value:'viewer',label:'Viewer · read only'},{value:'member',label:'Member · assigned personal work'}]}/></FormField>
   <button type="submit" disabled={busy||!selected}>Grant project access</button>
  </form>
  <ul>{data.members.map(member=><li key={member.user_id}>{member.name} · {member.user_id===data.owner?'Workspace owner':`${member.access} · ${member.state}`}
   {member.user_id!==data.owner&&member.state==='active'&&data.project.status==='active'&&<button type="button" disabled={busy} onClick={()=>void run('set_member',{user_id:member.user_id,access:member.access,state:'revoked'})}>Revoke {member.name}</button>}
  </li>)}</ul>
  <p>Unfinished assignments must be resolved before access removal. External invitations require the later sponsored invitation workflow.</p>
 </section>;
}
