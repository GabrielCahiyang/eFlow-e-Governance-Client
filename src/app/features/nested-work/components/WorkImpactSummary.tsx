import {ArrowRight,CalendarClock,FolderTree,Layers,ShieldAlert,UserMinus} from 'lucide-react';
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
export function WorkImpactSummary({impact,showBlockers=true}:{impact:WorkImpact;showBlockers?:boolean}){
 const date=impact.date_impact;
 const hasChildren=impact.descendant_count>0;
 const hasClearedLeads=impact.affected_appointment_count>0;
 return <div className="space-y-3 text-[13px]">
  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
   <div className="rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-surface,#fff)] p-3">
    <div className="flex items-center justify-between gap-2">
     <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--eflow-text-muted,#5e6b85)]">
      <Layers className="h-3.5 w-3.5 text-[#087972]" aria-hidden="true"/>
      Selected scope
     </span>
     <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${hasChildren?'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200':'border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f0f4fb)] text-[var(--eflow-text-secondary,#505c77)]'}`}>
      {impact.descendant_count} child
     </span>
    </div>
    <p className="mt-1.5 mb-0 text-[20px] font-bold leading-tight text-[var(--eflow-text,#161b35)]">{impact.selected_count}</p>
    <p className="mt-1 mb-0 text-[12px] leading-snug text-[var(--eflow-text-muted,#5e6b85)]">
     {impact.selected_count} subtasks in this selection; {impact.descendant_count} are child subtasks.
    </p>
   </div>
   <div className={`rounded-xl border p-3 ${hasClearedLeads?'border-amber-200 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/30':'border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-surface,#fff)]'}`}>
    <div className="flex items-center justify-between gap-2">
     <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--eflow-text-muted,#5e6b85)]">
      <UserMinus className={`h-3.5 w-3.5 ${hasClearedLeads?'text-amber-700 dark:text-amber-300':'text-[var(--eflow-text-muted,#5e6b85)]'}`} aria-hidden="true"/>
      Lead appointments
     </span>
     <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${hasClearedLeads?'border-amber-200 bg-amber-100/80 text-amber-900 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100':'border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f0f4fb)] text-[var(--eflow-text-secondary,#505c77)]'}`}>
      {hasClearedLeads?'Will be cleared':'None affected'}
     </span>
    </div>
    <p className="mt-1.5 mb-0 text-[20px] font-bold leading-tight text-[var(--eflow-text,#161b35)]">{impact.affected_appointment_count}</p>
    <p className="mt-1 mb-0 text-[12px] leading-snug text-[var(--eflow-text-muted,#5e6b85)]">
     {impact.affected_appointment_count} child Lead appointments will be cleared.
    </p>
   </div>
  </div>
  {(impact.before_path.length>0||impact.after_path.length>0)&&<div className="space-y-2 rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-surface,#fff)] p-3">
   {impact.before_path.length>0&&<div className="flex flex-wrap items-center gap-2">
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--eflow-text-muted,#5e6b85)]">
     <FolderTree className="h-3.5 w-3.5" aria-hidden="true"/>
     Current location:
    </span>
    <span className="inline-flex items-center rounded-md border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f0f4fb)] px-2 py-0.5 text-[12px] font-semibold text-[var(--eflow-text,#161b35)]">
     {impact.before_path.join(' / ')}
    </span>
   </div>}
   {impact.after_path.length>0&&<div className="flex flex-wrap items-center gap-2">
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--eflow-text-muted,#5e6b85)]">
     <ArrowRight className="h-3.5 w-3.5 text-[#087972]" aria-hidden="true"/>
     Resulting location:
    </span>
    <span className="inline-flex items-center rounded-md border border-[#087972]/40 bg-[#eef8f6] px-2 py-0.5 text-[12px] font-semibold text-[#085c56] dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-200">
     {impact.after_path.join(' / ')}
    </span>
   </div>}
  </div>}
  {date&&date.old_due!==date.new_due&&<div className="space-y-2.5 rounded-xl border border-[#bfd8f8] bg-[#f0f7ff]/70 p-3 dark:border-sky-800/70 dark:bg-sky-950/40">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#0d2d52] dark:text-sky-100">
     <CalendarClock className="h-4 w-4 text-[#0067d3] dark:text-sky-300" aria-hidden="true"/>
     Due date: {date.old_due||'No date'} → {date.new_due||'No date'}
    </span>
    <span className="rounded-full bg-[#dcebfb] px-2 py-0.5 text-[11px] font-medium text-[#0058b8] dark:bg-sky-900/80 dark:text-sky-200">
     Child dates will not be changed.
    </span>
   </div>
   {date.items.length>0&&<ul className="m-0 list-none space-y-1.5 p-0">
    {date.items.map(item=><li key={item.id} className="rounded-lg border border-[#bfd8f8]/80 bg-[var(--eflow-surface,#fff)] px-3 py-2 text-[12px] dark:border-sky-800/60">
     <div className="font-semibold text-[var(--eflow-text,#161b35)]">{item.path.join(' / ')}</div>
     <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[var(--eflow-text-muted,#5e6b85)]">
      <span>deadline bound {item.old_bound||'No bound'} → {item.new_bound||'No bound'}</span>
      {Object.values(item.history_counts).some(count=>count>0)&&<span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200">Recorded work or commitments require review.</span>}
     </div>
    </li>)}
   </ul>}
  </div>}
  {showBlockers&&!impact.allowed&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-rose-950 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-100">
   <div className="flex items-center gap-2 text-[12.5px] font-semibold">
    <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden="true"/>
    <span>Blocked — resolve these before continuing</span>
   </div>
   <ul className="mt-1.5 mb-0 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed">
    {workImpactBlockers(impact).map(message=><li key={message}>{message}</li>)}
   </ul>
  </div>}
 </div>;
}
