import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import {useId,useState} from 'react';
import {Plus,Search,Users,X} from 'lucide-react';
import {deduplicateWorkPersonIds,displayedWorkContributorIds,eligibleWorkPeople,resolveWorkPersonName} from '../selectors/people';
import type {WorkActionAvailability,WorkPerson} from '../types';

function initials(name:string):string {
 const parts=name.trim().split(/\s+/).filter(Boolean);
 if(!parts.length)return '?';
 return parts.slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('');
}

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
 return <fieldset className="nw-staffing-card" disabled={disabled}>
  <div className="nw-staffing-card__head">
   <legend><Users size={15} aria-hidden="true"/>Contributors <span className="nw-staffing-count">{contributors.length}</span></legend>
   <span className="nw-staffing-sub">Optional · Lead can work independently</span>
  </div>
  {contributors.length
   ? <ul className="nw-staffing-chips" aria-label="Selected contributors">{contributors.map(personId=>{
     const personName=resolveWorkPersonName(people,personId);
     return <li key={personId}><span>
      <span className="nw-staffing-avatar nw-staffing-avatar--sm">{initials(personName)}</span>
      <span className="nw-staffing-chip-name">{personName}</span>
      <WorkspaceTooltip content={`Remove contributor ${personName}`}><button type="button" disabled={disabled} aria-label={`Remove contributor ${personName}`} onClick={()=>{
       if(!disabled)onChange(deduplicateWorkPersonIds(contributorIds).filter(selected=>selected!==personId));
      }}><X size={13} aria-hidden="true"/></button></WorkspaceTooltip>
     </span></li>;
    })}</ul>
   : <p className="nw-staffing-empty-chips">No contributors selected yet.</p>}
  <div className="nw-staffing-search-block">
   <label className="nw-staffing-label" htmlFor={id}>Find people</label>
   <div className="nw-staffing-search-wrap">
    <Search size={15} className="nw-staffing-search-icon" aria-hidden="true"/>
    <input id={id} className="nw-staffing-search" type="search" placeholder="Search office members by name" value={query} disabled={disabled} aria-describedby={disabled?`${id}-reason`:undefined} onChange={event=>setQuery(event.target.value)}/>
   </div>
  </div>
  <div className="nw-staffing-people-grid" aria-label="Available project contributors">
   {matches.map(person=>{
    const personName=resolveWorkPersonName(people,person.id);
    return <button key={person.id} type="button" className="nw-staffing-person-btn" disabled={disabled} aria-label={`Add contributor ${personName}`} onClick={()=>{
     if(!disabled&&eligibleWorkPeople(people).some(current=>current.id===person.id))onChange(deduplicateWorkPersonIds([...contributorIds,person.id]));
    }}>
     <span className="nw-staffing-person-info">
      <span className="nw-staffing-avatar">{initials(personName)}</span>
      <span>{personName}</span>
     </span>
     <span className="nw-staffing-add-pill"><Plus size={13} aria-hidden="true"/>Add</span>
    </button>;
   })}
  </div>
  {!matches.length&&<p className="nw-staffing-hint">{available.length?'No matching office members.':'All available eligible office members are already on this task.'}</p>}
  {disabled&&<p id={`${id}-reason`} className="nw-staffing-hint nw-staffing-hint--lock">{busy?busyReason||'Saving…':reason}</p>}
 </fieldset>;
}
