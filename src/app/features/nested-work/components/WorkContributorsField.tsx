import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import {useId,useState} from 'react';
import {Plus,Search,Users,X} from 'lucide-react';
import {deduplicateWorkPersonIds,displayedWorkContributorIds,eligibleWorkPeople,groupWorkAssignmentPeople,resolveWorkPersonName,type WorkPeoplePriority} from '../selectors/people';
import type {WorkActionAvailability,WorkPerson} from '../types';
import {WorkloadStatusTag,type MemberWorkloadSummary} from '../../workload';

function initials(name:string):string {
 const parts=name.trim().split(/\s+/).filter(Boolean);
 if(!parts.length)return '?';
 return parts.slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('');
}

export interface WorkContributorsFieldProps {
 leadId:string|null;
 contributorIds:readonly string[];
 people:readonly WorkPerson[];
 priority?:WorkPeoplePriority;
 /** Fresh manage_contributors result from the NW2 adapter for this root/node. */
 contributorCapability:WorkActionAvailability|undefined;
 busy:boolean;
 busyReason?:string;
 workloadByUser?:Map<string,MemberWorkloadSummary>;
 onInspectWorkload?:(userId:string)=>void;
 onChange:(contributorIds:string[])=>void;
}

export function WorkContributorsField({leadId,contributorIds,people,priority,contributorCapability,busy,busyReason,workloadByUser,onInspectWorkload,onChange}:WorkContributorsFieldProps) {
 const id=useId(),[query,setQuery]=useState('');
 const contributors=displayedWorkContributorIds(leadId,contributorIds);
 const priorityIds=priority?new Set(priority.ids):null;
 const scopedEligible=eligibleWorkPeople(people).filter(person=>!priorityIds||priorityIds.has(person.id));
 const available=scopedEligible.filter(person=>person.id!==leadId&&!contributors.includes(person.id));
 const groups=groupWorkAssignmentPeople(available,priority,query).filter(group=>group.people.length>0);
 const disabled=busy||contributorCapability?.allowed!==true||contributorCapability.reason_code!==null;
 const reason=!leadId&&contributorCapability?.reason_code==='lifecycle_blocked'?'Choose a lead first.':contributorCapability?.disabledReason||'Refresh this task to edit its team.';
 const blockerReason=disabled&&!busy?reason:'';
 return <fieldset className="nw-staffing-card" aria-label={`Contributors (${contributors.length})`} aria-disabled={disabled||undefined} style={disabled?{background:'var(--eflow-subtle, #f0f4fb)'}:undefined}>
  <div className="nw-staffing-card__head">
   <legend><Users size={15} aria-hidden="true"/>Contributors <span className="nw-staffing-count">{contributors.length}</span></legend>
   <ActionBlockerGroup actionLabel="Edit contributors" blockers={blockerReason} busy={busy} size="sm">
    <span className="nw-staffing-sub">Optional · Lead can work independently</span>
   </ActionBlockerGroup>
  </div>
  {contributors.length
   ? <ul className="nw-staffing-chips" aria-label="Selected contributors">{contributors.map(personId=>{
     const personName=resolveWorkPersonName(people,personId);
     const memberLoad=workloadByUser?.get(personId);
     return <li key={personId}><span>
      <span className="nw-staffing-avatar nw-staffing-avatar--sm">{initials(personName)}</span>
      <span className="nw-staffing-chip-name">{personName}</span>
      {memberLoad&&(memberLoad.tier==='heavy'||memberLoad.tier==='overloaded')&&(
       <WorkloadStatusTag
        tier={memberLoad.tier}
        loadPoints={memberLoad.loadPoints}
        compact
        onClick={!disabled&&onInspectWorkload?()=>onInspectWorkload(personId):undefined}
        title="View contributor workload breakdown"
       />
      )}
      <WorkspaceTooltip content={`Remove contributor ${personName}`} disabled={disabled}><button type="button" disabled={disabled} aria-label={`Remove contributor ${personName}`} onClick={()=>{
       if(!disabled)onChange(deduplicateWorkPersonIds(contributorIds).filter(selected=>selected!==personId));
      }}><X size={13} aria-hidden="true"/></button></WorkspaceTooltip>
     </span></li>;
    })}</ul>
   : <p className="nw-staffing-empty-chips">No contributors selected yet.</p>}
  <div className="nw-staffing-search-block">
   <label className="nw-staffing-label" htmlFor={id}>Find people</label>
   <div className="nw-staffing-search-wrap">
    <Search size={15} className="nw-staffing-search-icon" aria-hidden="true"/>
    <input id={id} className="nw-staffing-search" type="search" maxLength={120} placeholder={priority?(priority.label==='On this task'?'Search task members by name':'Search parent subtask members by name'):'Search eligible members by name'} value={query} disabled={disabled} aria-describedby={disabled?`${id}-reason`:undefined} onChange={event=>setQuery(event.target.value)}/>
   </div>
  </div>
  <div className="nw-staffing-available" aria-label="Available project contributors">
   {groups.map(group=><div key={group.label} role={priority?'group':undefined} aria-label={priority?group.label:undefined}>
    {priority&&<h4 className="nw-staffing-group-label">{group.label}</h4>}
    <div className="nw-staffing-people-grid">{group.people.map(person=>{
    const personName=resolveWorkPersonName(people,person.id);
    const memberLoad=workloadByUser?.get(person.id);
    return <button key={person.id} type="button" className="nw-staffing-person-btn w-full" disabled={disabled} aria-label={`Add contributor ${personName}`} onClick={()=>{
     if(!disabled&&scopedEligible.some(current=>current.id===person.id))onChange(deduplicateWorkPersonIds([...contributorIds,person.id]));
    }}>
     <span className="nw-staffing-person-info">
      <span className="nw-staffing-avatar">{initials(personName)}</span>
      <span className="min-w-0 truncate">{personName}</span>
      {memberLoad&&(memberLoad.tier==='heavy'||memberLoad.tier==='overloaded')&&(
       <WorkloadStatusTag tier={memberLoad.tier} loadPoints={memberLoad.loadPoints} compact />
      )}
     </span>
     <span className="nw-staffing-add-pill"><Plus size={13} aria-hidden="true"/>Add</span>
    </button>;
   })}</div></div>)}
  </div>
  {!groups.length&&<p className="nw-staffing-hint">{available.length?'No matching eligible members.':priority?'All available task members are already on this subtask.':'All available eligible office members are already on this task.'}</p>}
  {disabled&&busy&&<p id={`${id}-reason`} className="nw-staffing-hint nw-staffing-hint--lock">{busyReason||'Saving…'}</p>}
  {disabled&&!busy&&<p id={`${id}-reason`} className="sr-only">{reason}</p>}
 </fieldset>;
}
