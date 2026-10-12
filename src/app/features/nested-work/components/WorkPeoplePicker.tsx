import {ProjectInvitations} from '../../project-invitations';
import {WorkLeadField} from './WorkLeadField';
import {WorkContributorsField} from './WorkContributorsField';
import type {WorkActionAvailability,WorkPerson} from '../types';
export function WorkPeoplePicker({people,selected,lead,onSelected,onLead,appointmentCapability,contributorCapability,disabled=false,invite}:{
 invite?:{project:string;office:string|null;root:string;node?:string;canRequest:boolean};
 people:WorkPerson[];selected:string[];lead:string;onSelected:(ids:string[])=>void;onLead:(id:string)=>void;
 appointmentCapability:WorkActionAvailability;contributorCapability:WorkActionAvailability;disabled?:boolean;
}){
 return <div className="r7-people">
  <WorkLeadField leadId={lead||null} contributorIds={selected} people={people} appointmentCapability={appointmentCapability} busy={disabled}
   onChange={(id,retained)=>{onLead(id);onSelected(retained);}}/>
  <WorkContributorsField leadId={lead||null} contributorIds={selected} people={people} contributorCapability={contributorCapability} busy={disabled} onChange={onSelected}/>
  {!disabled&&invite&&<ProjectInvitations {...invite}/>}
 </div>;
}
