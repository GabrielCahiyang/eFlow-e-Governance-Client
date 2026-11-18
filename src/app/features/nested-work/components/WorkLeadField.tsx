import {useId} from 'react';
import {ChevronDown, UserCheck} from 'lucide-react';
import {deduplicateWorkPersonIds,eligibleWorkPeople,resolveWorkPersonName} from '../selectors/people';
import type {WorkActionAvailability,WorkPerson} from '../types';

function initials(name:string):string {
 const parts=name.trim().split(/\s+/).filter(Boolean);
 if(!parts.length)return '?';
 return parts.slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('');
}

export interface WorkLeadFieldProps {
 leadId:string|null;
 /** Keep original workers here (even if they include Lead); display excludes Lead. */
 contributorIds:readonly string[];
 people:readonly WorkPerson[];
 /** Fresh appoint_lead result from the NW2 adapter for this root/node. */
 appointmentCapability:WorkActionAvailability|undefined;
 busy:boolean;
 busyReason?:string;
 onChange:(leadId:string,retainedContributorIds:string[])=>void;
}

export function WorkLeadField({leadId,contributorIds,people,appointmentCapability,busy,busyReason,onChange}:WorkLeadFieldProps) {
 const id=useId(),eligible=eligibleWorkPeople(people);
 const disabled=busy||appointmentCapability?.allowed!==true||appointmentCapability.reason_code!==null;
 const reason=appointmentCapability?.disabledReason||'Lead appointment availability could not be verified. Reload the work.';
 const historical=!!leadId&&!eligible.some(person=>person.id===leadId);
 const currentName=leadId?resolveWorkPersonName(people,leadId):'';
 return <fieldset className="nw-staffing-card" disabled={disabled}>
  <div className="nw-staffing-card__head">
   <legend><UserCheck size={15} aria-hidden="true"/>Lead</legend>
   {leadId
    ? <span className="nw-staffing-badge nw-staffing-badge--active"><span className="nw-staffing-avatar">{initials(currentName)}</span>{currentName}</span>
    : <span className="nw-staffing-badge nw-staffing-badge--warn">Needs reassignment</span>}
  </div>
  <label className="nw-staffing-label" htmlFor={id}>Appointed Lead</label>
  <div className="nw-staffing-select-wrap">
   <select id={id} className="nw-staffing-select" value={leadId||''} disabled={disabled} aria-describedby={disabled?`${id}-reason`:undefined} onChange={event=>{
    const next=event.target.value;
    if(!disabled&&next!==leadId&&eligible.some(person=>person.id===next))onChange(next,deduplicateWorkPersonIds(contributorIds));
   }}>
    <option value="" disabled>Choose project person</option>
    {historical&&<option value={leadId!} disabled>{resolveWorkPersonName(people,leadId!)} · Previously assigned</option>}
    {eligible.map(person=><option key={person.id} value={person.id}>{resolveWorkPersonName(people,person.id)}</option>)}
   </select>
   <ChevronDown size={16} className="nw-staffing-select-icon" aria-hidden="true"/>
  </div>
  {disabled&&<p id={`${id}-reason`} className="nw-staffing-hint">{busy?busyReason||'Saving…':reason}</p>}
  {!eligible.length&&<p className="nw-staffing-hint">No eligible Office members are available to assign.</p>}
 </fieldset>;
}
