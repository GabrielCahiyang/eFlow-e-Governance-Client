import type {BudgetAccountSnapshot,BudgetProtection,BudgetSection,OfficeBudgetVersion} from '../types';
import {peso} from '../components/budgetUi';
export function budgetProtectionIssue(saved:BudgetSection[],proposed:BudgetSection[]):BudgetProtection|null{
 for(const account of saved.filter(row=>!row.retired)){
  const minimum=account.protectedAmount??Math.max(account.committedAmount||0,account.spentAmount||0);
  if(minimum<=0)continue;
  const next=proposed.find(row=>row.id===account.id&&!row.retired);
  const parent=proposed.some(row=>row.parentId===account.id&&!row.retired);
  const entered=next&&!parent?next.amount:0,hold=next&&!parent?next.heldAmount:0;
  if(Math.round((entered-hold)*100)<Math.round(minimum*100))return {kind:'budget_account_protected',account:account.name,entered,minimum:minimum+hold,sources:account.reservations||[]};
 }
 return null;
}
export function budgetVersionChanges(before:OfficeBudgetVersion,after:OfficeBudgetVersion){
 const old=new Map(before.accounts.map(row=>[row.id,row])),next=new Map(after.accounts.map(row=>[row.id,row]));
 const changes:{account:string;field:string;before:string;after:string}[]=[];
 const values=(row:BudgetAccountSnapshot)=>({Name:row.name,Budget:peso.format(row.amount),'For later release':peso.format(row.heldAmount),'Account code':row.accountCode||'None','Parent account':row.parentId?(next.get(row.parentId)?.name||old.get(row.parentId)?.name||'Parent account'):'None','Release schedule':(row.releaseSchedule||[]).map(r=>`${r.date}: ${peso.format(r.amount)} (${r.status})`).join('; ')||'None',Order:String(row.position+1)});
 for(const [id,row] of next){const prior=old.get(id);if(!prior){changes.push({account:row.name,field:'Added',before:'—',after:peso.format(row.amount)});continue;}
  const a=values(prior),b=values(row);for(const field of Object.keys(a) as (keyof typeof a)[])if(a[field]!==b[field])changes.push({account:row.name,field,before:a[field],after:b[field]});
 }
 for(const [id,row] of old)if(!next.has(id))changes.push({account:row.name,field:'Removed',before:peso.format(row.amount),after:'—'});
 if(before.q4Target!==after.q4Target&&after.q4Target!==undefined)changes.push({account:'Office budget',field:'Q4 utilization target',before:before.q4Target===undefined?'Not recorded':`${before.q4Target}%`,after:`${after.q4Target}%`});
 return changes;
}
