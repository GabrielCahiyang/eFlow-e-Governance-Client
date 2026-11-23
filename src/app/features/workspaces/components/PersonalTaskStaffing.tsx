import { useId, useRef, useState } from 'react';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { FormField, SelectInput } from '../../../components/ui/FormField';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import type { PersonalCommand, PersonalMember, PersonalTask } from '../types';

export function PersonalTaskStaffing({task,members,busy,run,onClose}:{task:PersonalTask;members:PersonalMember[];busy:boolean;run:(command:PersonalCommand,payload:Record<string,unknown>)=>Promise<boolean>;onClose:()=>void}){
 const [lead,setLead]=useState(task.lead_id||''),[reviewer,setReviewer]=useState(task.reviewer_id||'');
 const [leadTipOpen,setLeadTipOpen]=useState(false),[reviewerTipOpen,setReviewerTipOpen]=useState(false);
 const leadRef=useRef<HTMLDivElement|null>(null),reviewerRef=useRef<HTMLDivElement|null>(null);
 const leadId=useId(),reviewerId=useId(),leadTipId=useId(),reviewerTipId=useId();
 const options=members.filter(m=>m.state==='active'&&m.eligible).map(m=>({value:m.user_id,label:m.name}));
 const reviewerRequired=Boolean(task.reviewer_id);
 const leadError=!lead?'Select an active task lead.':'';
 const reviewerError=reviewerRequired&&!reviewer?'Select an independent reviewer (different from the task lead).':'';
 const saveBlockedReason=busy?'':leadError||reviewerError||'';
 useNavigationBlocker({label:`Staffing ${task.title}`,identity:task.id,dirty:lead!==task.lead_id||reviewer!==(task.reviewer_id||''),pending:busy,onDiscard:onClose});
 return <form className="r3-members-form" onSubmit={async e=>{e.preventDefault();if(leadError||reviewerError)return;if(await run('staff_task',{task_id:task.id,revision:task.revision,lead_id:lead,reviewer_id:reviewer||null}))onClose();}}>
  <FormField label={`Lead for ${task.title}`} controlId={leadId} required error={leadError||undefined}>
   <div ref={leadRef} onMouseEnter={()=>setLeadTipOpen(true)} onMouseLeave={()=>setLeadTipOpen(false)}>
    <SelectInput id={leadId} value={lead||''} disabled={busy} placeholder={lead?undefined:'Choose task lead'} options={options} hasError={Boolean(leadError)} aria-required aria-invalid={Boolean(leadError)||undefined} aria-describedby={leadTipOpen&&leadError?leadTipId:undefined} onFocus={()=>setLeadTipOpen(true)} onBlur={()=>setLeadTipOpen(false)} onChange={e=>{setLead(e.target.value);if(e.target.value===reviewer)setReviewer('');}}/>
    <FieldValidationTooltip id={leadTipId} anchorRef={leadRef} message={leadError||undefined} open={leadTipOpen&&Boolean(leadError)} tone="error"/>
   </div>
  </FormField>
  <FormField label={`Reviewer for ${task.title}`} controlId={reviewerId} required={reviewerRequired} error={reviewerError||undefined}>
   <div ref={reviewerRef} onMouseEnter={()=>setReviewerTipOpen(true)} onMouseLeave={()=>setReviewerTipOpen(false)}>
    <SelectInput id={reviewerId} value={reviewer} disabled={busy} options={[{value:'',label:task.reviewer_id?'Choose independent reviewer':'No review required'},...options.filter(p=>p.value!==lead)]} hasError={Boolean(reviewerError)} aria-required={reviewerRequired||undefined} aria-invalid={Boolean(reviewerError)||undefined} aria-describedby={reviewerTipOpen&&reviewerError?reviewerTipId:undefined} onFocus={()=>setReviewerTipOpen(true)} onBlur={()=>setReviewerTipOpen(false)} onChange={e=>setReviewer(e.target.value)}/>
    <FieldValidationTooltip id={reviewerTipId} anchorRef={reviewerRef} message={reviewerError||undefined} open={reviewerTipOpen&&Boolean(reviewerError)} tone="error"/>
   </div>
  </FormField>
  <p>Staffing reopens submitted work for a new submission. Required review remains mandatory.</p>
  <WorkspaceTooltip content={saveBlockedReason} disabled={!saveBlockedReason}>
   <span className="inline-flex">
    <button type="submit" disabled={busy||Boolean(leadError||reviewerError)}>Save staffing</button>
   </span>
  </WorkspaceTooltip>
  <button type="button" disabled={busy} onClick={onClose}>Cancel staffing</button>
 </form>;
}
