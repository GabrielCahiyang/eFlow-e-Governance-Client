import {useId,useState} from 'react';
import {ChevronDown,Search,UserCheck} from 'lucide-react';
import {deduplicateWorkPersonIds,eligibleWorkPeople,groupWorkAssignmentPeople,resolveWorkPersonName,type WorkPeoplePriority} from '../selectors/people';
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
 excludedLeadIds?:readonly string[];
 priority?:WorkPeoplePriority;
 /** Fresh appoint_lead result from the NW2 adapter for this root/node. */
 appointmentCapability:WorkActionAvailability|undefined;
 busy:boolean;
 busyReason?:string;
 onChange:(leadId:string,retainedContributorIds:string[])=>void;
}

export function WorkLeadField({leadId,contributorIds,people,excludedLeadIds,priority,appointmentCapability,busy,busyReason,onChange}:WorkLeadFieldProps) {
 const id=useId(),[query,setQuery]=useState('');
 const excluded=new Set((excludedLeadIds||[]).filter(Boolean));
 const selectablePeople=excluded.size?people.filter(person=>!excluded.has(person.id)):people;
 const eligible=eligibleWorkPeople(selectablePeople);
 const groups=groupWorkAssignmentPeople(selectablePeople,priority,query);
 const currentFiltered=!!leadId&&!excluded.has(leadId)&&!groups.some(group=>group.people.some(person=>person.id===leadId));
 const disabled=busy||appointmentCapability?.allowed!==true||appointmentCapability.reason_code!==null;
 const reason=appointmentCapability?.disabledReason||'Lead appointment availability could not be verified. Reload the work.';
 const historical=!!leadId&&!excluded.has(leadId)&&!eligible.some(person=>person.id===leadId);
 const currentName=leadId?resolveWorkPersonName(people,leadId):'';
 return <fieldset className="nw-staffing-card" disabled={disabled}>
  <div className="nw-staffing-card__head">
   <legend><UserCheck size={15} aria-hidden="true"/>Lead</legend>
   {leadId
    ? <span className="nw-staffing-badge nw-staffing-badge--active"><span className="nw-staffing-avatar">{initials(currentName)}</span>{currentName}</span>
    : <span className="nw-staffing-badge nw-staffing-badge--warn">Needs reassignment</span>}
  </div>
  {priority&&<div className="nw-staffing-search-block">
   <label className="nw-staffing-label" htmlFor={`${id}-search`}>Find a lead</label>
   <div className="nw-staffing-search-wrap"><Search size={15} className="nw-staffing-search-icon" aria-hidden="true"/>
    <input id={`${id}-search`} className="nw-staffing-search" type="search" maxLength={120} placeholder="Search eligible members by name" value={query} disabled={disabled} onChange={event=>setQuery(event.target.value)}/>
   </div>
  </div>}
  <label className="nw-staffing-label" htmlFor={id}>Appointed Lead</label>
  <div className="nw-staffing-select-wrap">
   <select id={id} className="nw-staffing-select" value={leadId&&!excluded.has(leadId)?leadId:''} disabled={disabled} aria-describedby={disabled?`${id}-reason`:undefined} onChange={event=>{
    const next=event.target.value;
    if(!disabled&&next!==leadId&&!excluded.has(next)&&eligible.some(person=>person.id===next))onChange(next,deduplicateWorkPersonIds(contributorIds));
   }}>
    <option value="" disabled>Choose eligible member</option>
    {historical&&<option value={leadId!} disabled>{resolveWorkPersonName(people,leadId!)} · Previously assigned</option>}
    {!historical&&currentFiltered&&<option value={leadId!}>{currentName}</option>}
    {groups.filter(group=>group.people.length>0).map(group=>priority
     ?<optgroup key={group.label} label={group.label}>{group.people.map(person=><option key={person.id} value={person.id}>{resolveWorkPersonName(people,person.id)}</option>)}</optgroup>
     :group.people.map(person=><option key={person.id} value={person.id}>{resolveWorkPersonName(people,person.id)}</option>))}
   </select>
   <ChevronDown size={16} className="nw-staffing-select-icon" aria-hidden="true"/>
  </div>
  {disabled&&<p id={`${id}-reason`} className="nw-staffing-hint">{busy?busyReason||'Saving…':reason}</p>}
  {!eligible.length&&<p className="nw-staffing-hint">No eligible Office members are available to assign.</p>}
  {!!eligible.length&&!groups.some(group=>group.people.length>0)&&<p className="nw-staffing-hint">No matching eligible members.</p>}
 </fieldset>;
}
