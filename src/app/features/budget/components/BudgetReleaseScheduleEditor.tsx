import {CalendarDays,Plus,Trash2,CheckCircle2} from 'lucide-react';
import {MoneyInput} from '../../../components/ui/MoneyInput';
import type {BudgetScheduledRelease,BudgetSection} from '../types';
import {accountReleaseSchedule,pendingReleaseAmount} from '../selectors/budgetReleaseSchedule';
import {peso} from './budgetUi';
import './budgetReleaseCalendar.css';

export function BudgetReleaseScheduleEditor({account,year,disabled,onChange}:{account:BudgetSection;year?:number;disabled:boolean;onChange:(update:Partial<BudgetSection>)=>void}){
 const rows=accountReleaseSchedule(account);
 const save=(next:BudgetScheduledRelease[])=>onChange({releaseSchedule:next,heldAmount:pendingReleaseAmount(next)});
 const patch=(id:string,update:Partial<BudgetScheduledRelease>)=>save(rows.map(row=>row.id===id?{...row,...update}:row));
 return <div className="budget-release-editor"><header><span><CalendarDays size={17}/>Release schedule</span><strong>{peso.format(account.heldAmount)} pending</strong></header>
  <p>Set when each amount becomes available after the budget is locked.</p>
  {rows.map((row,index)=><div className="budget-release-editor__row" key={row.id}>
   <label>Release {index+1} · date<input aria-label={`Release ${index+1} date for ${account.name}`} type="date" min={year?`${year}-01-01`:undefined} max={year?`${year}-12-31`:undefined} value={row.date} disabled={disabled||row.status==='confirmed'} onChange={e=>patch(row.id,{date:e.target.value})}/></label>
   <label>Amount<MoneyInput aria-label={`Release ${index+1} amount for ${account.name}`} value={row.amount||''} disabled={disabled||row.status==='confirmed'} onValueChange={value=>patch(row.id,{amount:Number(value)})}/></label>
   {row.status==='confirmed'?<span className="budget-release-status" data-status="confirmed"><CheckCircle2 size={14}/>Released</span>:!disabled&&<button type="button" aria-label={`Remove release ${index+1} for ${account.name}`} onClick={()=>save(rows.filter(r=>r.id!==row.id))}><Trash2 size={16}/></button>}
  </div>)}
  {!rows.length&&<small>Money without a scheduled release is not held back.</small>}
  {!disabled&&<button type="button" className="budget-release-add" disabled={rows.length>=100} onClick={()=>save([...rows,{id:crypto.randomUUID(),date:'',amount:0,status:'pending'}])}><Plus size={15}/>{rows.length?'Add another release':'Schedule a release'}</button>}
 </div>;
}
