import type {WorkCapabilityReasonCode,WorkImpact} from '../types';

const blockers:Record<WorkCapabilityReasonCode,string>={
 access_unavailable:'Verify current access before continuing.',read_only:'This work is read-only.',
 branch_denied:"You don't have permission to change all the affected work.",appointment_denied:"A person who manages the parent task or subtask must change this Lead assignment.",
 lifecycle_blocked:"The affected work is not in a status that allows this change. Check its current status before continuing.",history_blocked:"This change is blocked by recorded work, evidence, financial commitments or team assignments that depend on it. Review the affected work first.",
 project_on_hold:'Work updates are paused while the project is under review.',
 active_subtask_staffing_locked:'Subtask assignments are read-only for the Project Lead while the project is active.',
 active_staffing_locked:"After a project starts, Task Leads can't change the main task's contributors."
};
export const workImpactBlockers=(impact:WorkImpact)=>impact.blocker_codes.map(code=>blockers[code]);
export function WorkImpactSummary({impact}:{impact:WorkImpact}){
 const date=impact.date_impact;
 return <div>
  <p>{impact.selected_count} subtasks in this selection; {impact.descendant_count} are child subtasks.</p>
  <p>{impact.affected_appointment_count} child Lead appointments will be cleared.</p>
  {impact.before_path.length>0&&<p>Current location: {impact.before_path.join(' / ')}</p>}
  {impact.after_path.length>0&&<p>Resulting location: {impact.after_path.join(' / ')}</p>}
  {date&&date.old_due!==date.new_due&&<>
   <p>Due date: {date.old_due||'No date'} → {date.new_due||'No date'}. Child dates will not be changed.</p>
   <ul>{date.items.map(item=><li key={item.id}>{item.path.join(' / ')}: deadline bound {item.old_bound||'No bound'} → {item.new_bound||'No bound'}{Object.values(item.history_counts).some(count=>count>0)?' · Recorded work or commitments require review.':''}</li>)}</ul>
  </>}
  {!impact.allowed&&<ul role="alert">{workImpactBlockers(impact).map(message=><li key={message}>{message}</li>)}</ul>}
 </div>;
}
