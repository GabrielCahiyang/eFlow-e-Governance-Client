import {useState} from 'react';
import type {UserProfile} from '../../../types';
import {InviteMemberDialog} from '../../invitations';

export function ProjectSetupPeople({profiles,lead,selected,onChange,officeName,disabled}:{
 profiles:UserProfile[];lead:string;selected:string[];onChange:(ids:string[])=>void;officeName?:string;disabled:boolean;
}){
 const [query,setQuery]=useState(''),[inviting,setInviting]=useState(false),[sent,setSent]=useState(false);
 const eligible=profiles.filter(person=>person.is_active&&!['admin','super_admin','viewer'].includes(person.role));
 const visible=eligible.filter(person=>person.id===lead||`${person.full_name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <section className="pf-panel" aria-label="Project people">
  <h2>Choose Office members</h2>
  <p>Selected members gain project access after activation, subject to their current eligibility.</p>
  <label>Search Office members<input value={query} onChange={event=>setQuery(event.target.value)}/></label>
  <fieldset disabled={disabled}>
   <legend>Project team</legend>
   {visible.map(person=><label className="pf-checkbox" key={person.id}>
    <input type="checkbox" checked={person.id===lead||selected.includes(person.id)} disabled={person.id===lead}
     onChange={event=>onChange(event.target.checked?[...selected,person.id]:selected.filter(id=>id!==person.id))}/>
    {person.full_name}{person.id===lead?' · Project Lead':''}
   </label>)}
   {!visible.length&&<p>No eligible Office members match your search.</p>}
  </fieldset>
  {officeName&&<div><button type="button" disabled={disabled} onClick={()=>setInviting(true)}>Invite to Office by email</button>
   <p>Office invitations contain no project details. Invitees can be selected after they join.</p></div>}
  {sent&&<p role="status">Office invitations created. Check Invitations for delivery status.</p>}
  {inviting&&officeName&&<InviteMemberDialog officeName={officeName} open={inviting} onOpenChange={setInviting} onSent={()=>setSent(true)}/>}
 </section>;
}
