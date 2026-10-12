import type {WorkCapabilityReasonCode,WorkImpact} from '../types';

const blockers:Record<WorkCapabilityReasonCode,string>={
 access_unavailable:'Verify current access before continuing.',read_only:'This work is read-only.',
 branch_denied:'Current authority does not cover all affected work.',appointment_denied:'A current parent manager must change this Lead appointment.',
 lifecycle_blocked:'Resolve the affected work state before continuing.',history_blocked:'Recorded work, evidence, financial commitments or dependent staffing prevents this operation. Resolve the affected work first.'
};
export const workImpactBlockers=(impact:WorkImpact)=>impact.blocker_codes.map(code=>blockers[code]);
export function WorkImpactSummary({impact}:{impact:WorkImpact}){
 const date=impact.date_impact;
 return <div>
  <p>{impact.selected_count} subitems in the selected scope; {impact.descendant_count} are child subitems.</p>
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
