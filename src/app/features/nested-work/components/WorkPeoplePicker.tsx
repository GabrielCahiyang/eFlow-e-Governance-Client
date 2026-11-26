import {WorkLeadField} from './WorkLeadField';
import {WorkContributorsField} from './WorkContributorsField';
import type {WorkActionAvailability,WorkPerson} from '../types';
import type {WorkPeoplePriority} from '../selectors/people';
import type {MemberWorkloadSummary} from '../../workload';
export function WorkPeoplePicker({people,selected,lead,leadError,excludedLeadIds,onSelected,onLead,appointmentCapability,contributorCapability,disabled=false,disabledReason,priority,workloadByUser,onInspectWorkload}:{
 invite?:{project:string;office:string|null;root:string;node?:string;canRequest:boolean};
 people:WorkPerson[];selected:string[];lead:string;leadError?:string;excludedLeadIds?:readonly string[];onSelected:(ids:string[])=>void;onLead:(id:string)=>void;
 appointmentCapability:WorkActionAvailability;contributorCapability:WorkActionAvailability;disabled?:boolean;disabledReason?:string;
 priority?:WorkPeoplePriority;
 workloadByUser?:Map<string,MemberWorkloadSummary>;
 onInspectWorkload?:(userId:string)=>void;
}){
 return <div className="nw-staffing-picker">
  {priority&&<p className="nw-staffing-hint">Only people assigned to this {priority.label==='On this task'?'task':'parent subtask'} can be assigned to this subtask.</p>}
  <WorkLeadField leadId={lead||null} contributorIds={selected} people={people} excludedLeadIds={excludedLeadIds} priority={priority} appointmentCapability={appointmentCapability} busy={disabled} busyReason={disabledReason}
   error={leadError} workloadByUser={workloadByUser} onInspectWorkload={onInspectWorkload}
   onChange={(id,retained)=>{onLead(id);onSelected(retained);}}/>
  <WorkContributorsField leadId={lead||null} contributorIds={selected} people={people} priority={priority} contributorCapability={contributorCapability} busy={disabled} busyReason={disabledReason} workloadByUser={workloadByUser} onInspectWorkload={onInspectWorkload} onChange={onSelected}/>
 </div>;
}
