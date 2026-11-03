import type {BudgetScheduledRelease,BudgetSection} from '../types';

export function accountReleaseSchedule(account:BudgetSection):BudgetScheduledRelease[]{
 if(account.releaseSchedule?.length)return account.releaseSchedule;
 return account.heldAmount>0?[{id:account.id,date:'',amount:account.heldAmount,status:'pending'}]:[];
}
export function pendingReleaseAmount(rows:BudgetScheduledRelease[]){
 return rows.filter(row=>row.status==='pending').reduce((sum,row)=>sum+Math.round(row.amount*100),0)/100;
}
export function budgetReleaseScheduleError(account:BudgetSection){
 if(!account.releaseSchedule)return '';
 const rows=account.releaseSchedule;
 if(rows.length>100)return `Use at most 100 releases for “${account.name}”.`;
 if(new Set(rows.map(row=>row.id)).size!==rows.length)return `Each release in “${account.name}” needs a unique ID.`;
 for(const row of rows){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||Number.isNaN(Date.parse(row.date))||new Date(row.date).toISOString().slice(0,10)!==row.date)return `Choose a valid release date for “${account.name}”.`;
  if(!Number.isFinite(row.amount)||row.amount<=0||row.amount>90_000_000_000||Math.abs(row.amount*100-Math.round(row.amount*100))>.001)return `Enter a positive release amount for “${account.name}”.`;
  if(!['pending','confirmed'].includes(row.status))return 'Invalid release status.';
 }
 if(rows.reduce((sum,row)=>sum+Math.round(row.amount*100),0)>Math.round(account.amount*100))return `Scheduled releases exceed the budget for “${account.name}”.`;
 if(Math.round(pendingReleaseAmount(rows)*100)!==Math.round(account.heldAmount*100))return `Pending releases must match the held amount for “${account.name}”.`;
 return '';
}
export function releaseSchedulesYearError(accounts:BudgetSection[],year:number){
 return accounts.some(a=>!a.retired&&a.releaseSchedule?.some(r=>Number(r.date.slice(0,4))!==year))?`Choose release dates within fiscal year ${year}.`:'';
}
export function lockedReleaseEditError(saved:BudgetSection[],proposed:BudgetSection[]){
 for(const prior of saved.filter(a=>!a.retired)){
  const next=proposed.find(a=>a.id===prior.id&&!a.retired);
  if(!next&&(prior.heldAmount>0||prior.releaseSchedule?.length))return `Keep “${prior.name}” in the budget while it has release records.`;
  if(next&&Math.round(next.heldAmount*100)<Math.round(prior.heldAmount*100))return `Accounting must confirm releases from “${prior.name}” before the pending total can decrease. You can still change its release dates.`;
 }
 return '';
}
