import {WorkLeadField} from './WorkLeadField';
import {WorkContributorsField} from './WorkContributorsField';
import type {WorkActionAvailability,WorkPerson} from '../types';
import type {WorkPeoplePriority} from '../selectors/people';
export function WorkPeoplePicker({people,selected,lead,onSelected,onLead,appointmentCapability,contributorCapability,disabled=false,disabledReason,priority}:{
 invite?:{project:string;office:string|null;root:string;node?:string;canRequest:boolean};
 people:WorkPerson[];selected:string[];lead:string;onSelected:(ids:string[])=>void;onLead:(id:string)=>void;
 appointmentCapability:WorkActionAvailability;contributorCapability:WorkActionAvailability;disabled?:boolean;disabledReason?:string;
 priority?:WorkPeoplePriority;
}){
 return <div className="nw-staffing-picker">
  {priority&&<p className="nw-staffing-hint">{priority.label==='On this task'?'Task team':'Parent subtask team'} shown first. You can also choose other eligible members. Assignments apply to this subtask.</p>}
  <WorkLeadField leadId={lead||null} contributorIds={selected} people={people} priority={priority} appointmentCapability={appointmentCapability} busy={disabled} busyReason={disabledReason}
   onChange={(id,retained)=>{onLead(id);onSelected(retained);}}/>
  <WorkContributorsField leadId={lead||null} contributorIds={selected} people={people} priority={priority} contributorCapability={contributorCapability} busy={disabled} busyReason={disabledReason} onChange={onSelected}/>
 </div>;
}
