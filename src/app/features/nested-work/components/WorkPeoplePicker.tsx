import {ProjectInvitations} from '../../project-invitations';
import {WorkLeadField} from './WorkLeadField';
import {WorkContributorsField} from './WorkContributorsField';
import type {WorkActionAvailability,WorkPerson} from '../types';
export function WorkPeoplePicker({people,selected,lead,onSelected,onLead,appointmentCapability,contributorCapability,disabled=false,disabledReason,invite}:{
 invite?:{project:string;office:string|null;root:string;node?:string;canRequest:boolean};
 people:WorkPerson[];selected:string[];lead:string;onSelected:(ids:string[])=>void;onLead:(id:string)=>void;
 appointmentCapability:WorkActionAvailability;contributorCapability:WorkActionAvailability;disabled?:boolean;disabledReason?:string;
}){
 return <div className="r7-people">
  <WorkLeadField leadId={lead||null} contributorIds={selected} people={people} appointmentCapability={appointmentCapability} busy={disabled} busyReason={disabledReason}
   onChange={(id,retained)=>{onLead(id);onSelected(retained);}}/>
  <WorkContributorsField leadId={lead||null} contributorIds={selected} people={people} contributorCapability={contributorCapability} busy={disabled} busyReason={disabledReason} onChange={onSelected}/>
  {!disabled&&invite&&<details><summary>Invite someone new</summary><ProjectInvitations {...invite}/></details>}
 </div>;
}
