import {useId} from 'react';
import {deduplicateWorkPersonIds,eligibleWorkPeople,resolveWorkPersonName} from '../selectors/people';
import type {WorkActionAvailability,WorkPerson} from '../types';

export interface WorkLeadFieldProps {
 leadId:string|null;
 /** Keep original workers here (even if they include Lead); display excludes Lead. */
 contributorIds:readonly string[];
 people:readonly WorkPerson[];
 /** Fresh appoint_lead result from the NW2 adapter for this root/node. */
 appointmentCapability:WorkActionAvailability|undefined;
 busy:boolean;
 onChange:(leadId:string,retainedContributorIds:string[])=>void;
}

export function WorkLeadField({leadId,contributorIds,people,appointmentCapability,busy,onChange}:WorkLeadFieldProps) {
 const id=useId(),eligible=eligibleWorkPeople(people);
 const disabled=busy||appointmentCapability?.allowed!==true||appointmentCapability.reason_code!==null;
 const reason=appointmentCapability?.disabledReason||'Lead appointment availability could not be verified. Reload the work.';
 const historical=!!leadId&&!eligible.some(person=>person.id===leadId);
 return <fieldset className="r7-work r7-people" disabled={disabled}>
  <legend>Lead</legend>
  <label htmlFor={id}>Appointed Lead</label>
  <select id={id} value={leadId||''} disabled={disabled} aria-describedby={disabled?`${id}-reason`:undefined} onChange={event=>{
   const next=event.target.value;
   if(!disabled&&next!==leadId&&eligible.some(person=>person.id===next))onChange(next,deduplicateWorkPersonIds(contributorIds));
  }}>
   <option value="" disabled>Choose project person</option>
   {historical&&<option value={leadId!} disabled>{resolveWorkPersonName(people,leadId!)} · Previously assigned</option>}
   {eligible.map(person=><option key={person.id} value={person.id}>{resolveWorkPersonName(people,person.id)}</option>)}
  </select>
  {!leadId&&<p className="r7-help">Needs reassignment</p>}
  {disabled&&<p id={`${id}-reason`} className="r7-help">{busy?'People changes are being saved.':reason}</p>}
  {!eligible.length&&<p className="r7-help">No eligible project people are available. Review eligible people in project Members.</p>}
 </fieldset>;
}
