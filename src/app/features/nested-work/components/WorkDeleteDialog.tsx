import {AlertCircle,AlertTriangle,Loader2,RefreshCw} from 'lucide-react';
import type {WorkImpact} from '../types';
import {WorkImpactSummary} from './WorkImpactSummary';

export function WorkDeleteDialog({
 impact,
 loading=false,
 error='',
 onRetry,
}:{
 impact?:WorkImpact;
 loading?:boolean;
 error?:string;
 onRetry?:()=>void;
}){
 return <div className="space-y-3">
  <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-[13px] leading-relaxed text-rose-950 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-100">
   <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-300">
    <AlertTriangle className="h-4 w-4" aria-hidden="true"/>
   </span>
   <p className="m-0">Deletion removes the selected subtask and its children. Recorded work, evidence or financial history prevents deletion.</p>
  </div>
  {loading&&<div role="status" className="flex items-center gap-2.5 rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f6f9f8)] px-3.5 py-3 text-[13px] text-[var(--eflow-text-secondary,#505c77)]">
   <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#087972]" aria-hidden="true"/>
   <span>Checking affected subtasks and history…</span>
  </div>}
  {!loading&&error&&<div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-3 text-[13px] text-rose-900 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-100">
   <span className="flex min-w-0 flex-1 items-start gap-2">
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden="true"/>
    <span>{error}</span>
   </span>
   {onRetry&&<button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[12px] font-medium text-rose-800 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100">
    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true"/>
    Retry check
   </button>}
  </div>}
  {!loading&&!error&&impact&&<WorkImpactSummary impact={impact}/>}
 </div>;
}
