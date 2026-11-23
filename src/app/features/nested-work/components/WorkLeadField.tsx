import {useId,useRef,useState} from 'react';
import {ChevronDown,Search,UserCheck} from 'lucide-react';
import {FieldValidationTooltip} from '../../../components/ui/FieldValidationTooltip';
import {deduplicateWorkPersonIds,eligibleWorkPeople,groupWorkAssignmentPeople,resolveWorkPersonName,type WorkPeoplePriority} from '../selectors/people';
import type {WorkActionAvailability,WorkPerson} from '../types';
import {compactMemberWorkloadAnnotation,WorkloadStatusTag,type MemberWorkloadSummary} from '../../workload';

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
 error?:string;
 workloadByUser?:Map<string,MemberWorkloadSummary>;
 onInspectWorkload?:(userId:string)=>void;
 onChange:(leadId:string,retainedContributorIds:string[])=>void;
}

export function WorkLeadField({leadId,contributorIds,people,excludedLeadIds,priority,appointmentCapability,busy,busyReason,error,workloadByUser,onInspectWorkload,onChange}:WorkLeadFieldProps) {
 const id=useId(),[query,setQuery]=useState('');
 const [touched,setTouched]=useState(false),[focused,setFocused]=useState(false),[hovered,setHovered]=useState(false);
 const selectRef=useRef<HTMLSelectElement|null>(null);
 const excluded=new Set((excludedLeadIds||[]).filter(Boolean));
 const priorityIds=priority?new Set(priority.ids):null;
 const selectablePeople=excluded.size?people.filter(person=>!excluded.has(person.id)):people;
 const eligible=eligibleWorkPeople(selectablePeople).filter(person=>!priorityIds||priorityIds.has(person.id));
 const groups=groupWorkAssignmentPeople(selectablePeople,priority,query);
 const currentFiltered=!!leadId&&!excluded.has(leadId)&&!groups.some(group=>group.people.some(person=>person.id===leadId));
 const disabled=busy||appointmentCapability?.allowed!==true||appointmentCapability.reason_code!==null;
 const reason=appointmentCapability?.disabledReason||'Lead appointment availability could not be verified. Reload the work.';
 const historical=!!leadId&&!excluded.has(leadId)&&!eligible.some(person=>person.id===leadId);
 const currentName=leadId?resolveWorkPersonName(people,leadId):'';
 const currentWorkload=leadId?workloadByUser?.get(leadId):undefined;
 const computedError=!disabled
  ?(leadId&&excluded.has(leadId)
   ?'The Project Lead cannot be appointed as a Task Lead.'
   :historical
    ?'Previously assigned Lead is no longer eligible. Choose an eligible member.'
    :!leadId&&touched&&eligible.length>0
     ?'Choose an eligible Lead.'
     :'')
  :'';
 const fieldError=error||computedError;
 const isInvalid=Boolean(fieldError);
 const describedBy=[disabled?`${id}-reason`:undefined,isInvalid?`${id}-error`:undefined].filter(Boolean).join(' ')||undefined;
 return <fieldset className="nw-staffing-card" disabled={disabled}>
  <div className="nw-staffing-card__head">
   <legend><UserCheck size={15} aria-hidden="true"/>Lead</legend>
   <div className="flex items-center gap-1.5 flex-wrap">
    {leadId
     ? <span className="nw-staffing-badge nw-staffing-badge--active"><span className="nw-staffing-avatar">{initials(currentName)}</span>{currentName}</span>
     : <span className="nw-staffing-badge nw-staffing-badge--warn">Needs reassignment</span>}
    {leadId&&currentWorkload&&(
     <WorkloadStatusTag
      tier={currentWorkload.tier}
      loadPoints={currentWorkload.loadPoints}
      compact
      onClick={onInspectWorkload?()=>onInspectWorkload(leadId):undefined}
      title="View member workload breakdown"
     />
    )}
   </div>
  </div>
  {priority&&<div className="nw-staffing-search-block">
   <label className="nw-staffing-label" htmlFor={`${id}-search`}>Find a lead</label>
   <div className="nw-staffing-search-wrap"><Search size={15} className="nw-staffing-search-icon" aria-hidden="true"/>
    <input id={`${id}-search`} className="nw-staffing-search" type="search" maxLength={120} placeholder={priority.label==='On this task'?'Search task members by name':'Search parent subtask members by name'} value={query} disabled={disabled} onChange={event=>setQuery(event.target.value)}/>
   </div>
  </div>}
  <label className="nw-staffing-label" htmlFor={id}>Appointed Lead <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span></label>
  <div className="nw-staffing-select-wrap">
   <select
    ref={selectRef}
    id={id}
    className={`nw-staffing-select${isInvalid?' eflow-field-invalid':''}`}
    value={leadId&&!excluded.has(leadId)?leadId:''}
    disabled={disabled}
    aria-required="true"
    aria-invalid={isInvalid||undefined}
    aria-describedby={describedBy}
    onFocus={()=>setFocused(true)}
    onBlur={()=>{setFocused(false);setTouched(true);}}
    onMouseEnter={()=>setHovered(true)}
    onMouseLeave={()=>setHovered(false)}
    onChange={event=>{
     const next=event.target.value;
     setTouched(true);
     if(!disabled&&next!==leadId&&!excluded.has(next)&&eligible.some(person=>person.id===next))onChange(next,deduplicateWorkPersonIds(contributorIds));
    }}>
    <option value="" disabled>Choose eligible member</option>
    {historical&&<option value={leadId!} disabled>{resolveWorkPersonName(people,leadId!)} · Previously assigned</option>}
    {!historical&&currentFiltered&&<option value={leadId!}>{currentName}{compactMemberWorkloadAnnotation(currentWorkload)}</option>}
    {groups.filter(group=>group.people.length>0).map(group=>priority
     ?<optgroup key={group.label} label={group.label}>{group.people.map(person=><option key={person.id} value={person.id}>{resolveWorkPersonName(people,person.id)}{compactMemberWorkloadAnnotation(workloadByUser?.get(person.id))}</option>)}</optgroup>
     :group.people.map(person=><option key={person.id} value={person.id}>{resolveWorkPersonName(people,person.id)}{compactMemberWorkloadAnnotation(workloadByUser?.get(person.id))}</option>))}
   </select>
   <ChevronDown size={16} className="nw-staffing-select-icon" aria-hidden="true"/>
   <FieldValidationTooltip id={`${id}-tooltip`} anchorRef={selectRef} message={fieldError} open={isInvalid&&(focused||hovered)} tone="error"/>
  </div>
  {isInvalid&&<p id={`${id}-error`} role="alert" className="eflow-field-error mt-1 text-xs">{fieldError}</p>}
  {disabled&&<p id={`${id}-reason`} className="nw-staffing-hint">{busy?busyReason||'Saving…':reason}</p>}
  {!eligible.length&&<p className="nw-staffing-hint">{priority?'No eligible task members are available to assign.':'No eligible Office members are available to assign.'}</p>}
  {!!eligible.length&&!groups.some(group=>group.people.length>0)&&<p className="nw-staffing-hint">No matching eligible members.</p>}
 </fieldset>;
}
