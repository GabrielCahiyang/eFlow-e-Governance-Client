import { CalendarDays, Check, CheckCircle2, ClipboardList, UsersRound, Wallet, Building2, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ReadinessCheck } from '../types';

const presentation: Record<string, {title:string;icon:typeof Check}> = {
 structure:{title:'Work plan review',icon:ClipboardList}, dates:{title:'Schedule review',icon:CalendarDays},
 budget:{title:'Budget review',icon:Wallet}, schedule:{title:'Project dates',icon:CalendarDays},
 staffing:{title:'Task leads',icon:UsersRound}, work:{title:'Project tasks',icon:ClipboardList},
 office_identity:{title:'Office names',icon:Building2}, invitations:{title:'Office participation',icon:Building2},
 responsibilities:{title:'Office responsibilities',icon:ShieldCheck},
};

/** A compact action list; server checks remain the only source of readiness. */
export function SetupReadinessChecks({checks,actions}:{checks:ReadinessCheck[];actions:(check:ReadinessCheck)=>ReactNode}){
 const blockers=checks.filter(check=>!check.ok),confirmed=checks.filter(check=>check.ok);
 return <div className="setup-checks">
  {!!blockers.length&&<section aria-label="Readiness blockers">
   <div className="setup-checks__heading"><h4>Finish setup</h4><span>{blockers.length} remaining</span></div>
   <ul>{blockers.map(check=>{const item=presentation[check.key],Icon=item?.icon||ShieldCheck;
    return <li key={check.key} className="setup-check"><span className="setup-check__icon"><Icon size={19} aria-hidden="true"/></span>
     <div className="setup-check__copy"><strong>{item?.title||check.label}</strong><p>{['structure','dates','budget'].includes(check.key)?'Review the current plan, then confirm.':check.detail}</p></div>
     <div className="setup-check__actions">{actions(check)}</div>
    </li>;
   })}</ul>
  </section>}
  {!!confirmed.length&&<details className="setup-confirmed"><summary><CheckCircle2 size={18} aria-hidden="true"/>Confirmed checks ({confirmed.length})</summary>
   <ul>{confirmed.map(check=><li key={check.key}><Check size={16} aria-hidden="true"/><div><strong>{presentation[check.key]?.title||check.label}</strong><p>{check.key==='schedule'?'Project dates are set and the schedule is valid.':['structure','dates','budget'].includes(check.key)?'Current plan reviewed.':check.detail}</p></div></li>)}</ul>
  </details>}
 </div>;
}
