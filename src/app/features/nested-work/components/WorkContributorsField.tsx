import {useId,useState} from 'react';
import {deduplicateWorkPersonIds,displayedWorkContributorIds,eligibleWorkPeople,resolveWorkPersonName} from '../selectors/people';
import type {WorkActionAvailability,WorkPerson} from '../types';

export interface WorkContributorsFieldProps {
 leadId:string|null;
 contributorIds:readonly string[];
 people:readonly WorkPerson[];
 /** Fresh manage_contributors result from the NW2 adapter for this root/node. */
 contributorCapability:WorkActionAvailability|undefined;
 busy:boolean;
 busyReason?:string;
 onChange:(contributorIds:string[])=>void;
}

export function WorkContributorsField({leadId,contributorIds,people,contributorCapability,busy,busyReason,onChange}:WorkContributorsFieldProps) {
 const id=useId(),[query,setQuery]=useState('');
 const contributors=displayedWorkContributorIds(leadId,contributorIds);
 const available=eligibleWorkPeople(people).filter(person=>person.id!==leadId&&!contributors.includes(person.id));
 const matches=available.filter(person=>resolveWorkPersonName(people,person.id).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const disabled=busy||contributorCapability?.allowed!==true||contributorCapability.reason_code!==null;
 const reason=!leadId&&contributorCapability?.reason_code==='lifecycle_blocked'?'Choose a lead first.':contributorCapability?.disabledReason||'Refresh this task to edit its team.';
 return <fieldset className="r7-work r7-people" disabled={disabled}>
  <legend>Contributors ({contributors.length})</legend>
  {contributors.length?<ul className="r7-chips" aria-label="Selected contributors">{contributors.map(personId=><li key={personId}><span>
   {resolveWorkPersonName(people,personId)} <button type="button" disabled={disabled} aria-label={`Remove contributor ${resolveWorkPersonName(people,personId)}`} onClick={()=>{
    if(!disabled)onChange(deduplicateWorkPersonIds(contributorIds).filter(selected=>selected!==personId));
   }}>Remove</button>
  </span></li>)}</ul>:<p>No contributors</p>}
  <label htmlFor={id}>Find people</label>
  <input id={id} type="search" placeholder="Search by name" value={query} disabled={disabled} aria-describedby={disabled?`${id}-reason`:undefined} onChange={event=>setQuery(event.target.value)}/>
  <div className="r7-people-list" aria-label="Available project contributors">
   {matches.map(person=><button key={person.id} type="button" disabled={disabled} aria-label={`Add contributor ${resolveWorkPersonName(people,person.id)}`} onClick={()=>{
    if(!disabled&&eligibleWorkPeople(people).some(current=>current.id===person.id))onChange(deduplicateWorkPersonIds([...contributorIds,person.id]));
   }}>Add {resolveWorkPersonName(people,person.id)}</button>)}
  </div>
  {!matches.length&&<p className="r7-help">{available.length?'No matching project people.':'No additional eligible project people are available.'}</p>}
  {disabled&&<p id={`${id}-reason`} className="r7-help">{busy?busyReason||'Saving…':reason}</p>}
 </fieldset>;
}
