import type {UserProfile} from '../../../types';
import {getPhilippineCalendarDate} from '../../../shared/calendarDates';
export interface SetupDraft {title:string;description:string;scope:string;lead:string;start:string;end:string;noFunding:boolean}
export function ProjectSetupFields({step,draft,update,profiles,disabled,readOnlyReason,settings=false}:{step:number;draft:SetupDraft;update:(key:keyof SetupDraft,value:string|boolean)=>void;profiles:UserProfile[];disabled:boolean;readOnlyReason?:string;officeName?:string;settings?:boolean;automaticLead?:boolean;originalStart?:string}){
 const lockTitle=disabled?readOnlyReason:undefined;
 return <fieldset disabled={disabled} data-readonly={disabled&&readOnlyReason?'true':undefined} title={lockTitle} className="pf-wizard-fields">
  {step===0&&<>{!settings&&<div className="pf-section-heading"><p className="pf-eyebrow">PROJECT DETAILS</p><h2>Start with the essentials.</h2><p>Give your project a name and help your team understand what it’s here to achieve.</p></div>}<div className="pf-office-lead"><span>Project Lead</span><strong>{profiles.find(person=>person.id===draft.lead)?.full_name||'Appointed Office Head'}</strong><p>The Office Head creating this project is automatically its Project Lead.</p></div><label title={lockTitle}>Project title *<input autoFocus={!settings} readOnly={disabled} aria-disabled={disabled||undefined} value={draft.title} maxLength={200} onChange={e=>update('title',e.target.value)} placeholder="For example, Community enterprise support"/></label><label title={lockTitle}>Description *<textarea readOnly={disabled} aria-disabled={disabled||undefined} value={draft.description} maxLength={12000} onChange={e=>update('description',e.target.value)} placeholder="Background, objectives, beneficiaries and expected results."/></label></>}
  {step===1&&<>{!settings&&<div className="pf-section-heading"><p className="pf-eyebrow">SCOPE</p><h2>Define the boundaries.</h2><p>Describe what this project includes, its deliverables and anything outside its scope.</p></div>}<label title={lockTitle}>Scope of the project *<textarea autoFocus={!settings} readOnly={disabled} aria-disabled={disabled||undefined} value={draft.scope} maxLength={12000} onChange={e=>update('scope',e.target.value)} placeholder="What will this project deliver? What is outside the scope?"/></label></>}
  {step===2&&<>
   <div className="pf-section-heading"><p className="pf-eyebrow">TIMELINE</p><h2>When will the project run?</h2><p>Choose a start date of today or later.</p></div>
   <div className="pf-grid">
    <label>Project start date *<input type="date" value={draft.start} min={getPhilippineCalendarDate()} max={draft.end||undefined} onChange={event=>update('start',event.target.value)}/></label>
    <label>Project target date *<input type="date" value={draft.end} min={draft.start||undefined} onChange={event=>update('end',event.target.value)}/></label>
   </div>
  </>}
 </fieldset>;
}
