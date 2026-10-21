import { createContext, useContext, useState, type ReactNode } from 'react';
import { WalletCards } from 'lucide-react';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrgs } from '../../../hooks/useSupabaseData';
import { isAppointedOfficeHead } from '../../../shared/officeAuthority';
import type { Task } from '../../tasks';
import { useDepartmentBudget } from '../hooks/useDepartmentBudget';
import { getCurrentFiscalYear } from '../constants';
import { DirectWorkFunding } from './DirectWorkFunding';
import { peso } from './budgetUi';

const BudgetContext = createContext<Record<string,ReturnType<typeof useDepartmentBudget>>>({});
/** Share one ledger subscription across the table, including its totals. */
export function ProjectTaskBudgetProvider({officeId,officeIds=[],children}:{officeId?:string;officeIds?:string[];children:ReactNode}) {
  return <OfficeBudgetScope ids={[...new Set([officeId,...officeIds].filter((id):id is string=>!!id))]}>{children}</OfficeBudgetScope>;
}
function OfficeBudgetScope({ids,children}:{ids:string[];children:ReactNode}) {
  const parent=useContext(BudgetContext),id=ids[0],budget=useDepartmentBudget(id,getCurrentFiscalYear());
  if(!id)return <>{children}</>;
  return <BudgetContext.Provider value={{...parent,[id]:budget}}><OfficeBudgetScope ids={ids.slice(1)}>{children}</OfficeBudgetScope></BudgetContext.Provider>;
}
export function useProjectTaskBudgetTotal(taskIds:string[]) {
  const budgets=Object.values(useContext(BudgetContext));
  if(!budgets.length||budgets.some(budget=>budget.loading||budget.error))return null;
  const allocations=budgets.flatMap(budget=>budget.allocations).filter(a=>!a.subtaskId&&a.status==='approved'&&taskIds.includes(a.taskId));
  return allocations.reduce((sum,a,index)=>sum+(a.id&&allocations.findIndex(other=>other.id===a.id)!==index?0:a.amount),0);
}
export function ProjectTaskBudgetCell({task,readOnly=false}:{task:Task;readOnly?:boolean}) {
  const budgets=useContext(BudgetContext),{userProfile}=useAuth(),{orgs}=useOrgs();
  const budget=Object.values(budgets).find(item=>item.allocations.some(a=>a.taskId===task.id&&!a.subtaskId&&a.status==='approved'))||budgets[task.orgId||''];
  const [open,setOpen]=useState(false);
  const allocations=budget?.allocations.filter(a=>a.taskId===task.id&&!a.subtaskId&&a.status==='approved')||[];
  const amount=allocations.reduce((sum,a)=>sum+a.amount,0);
  const canFund=!readOnly&&!task.archivedAt&&!task.proposedOfficeIdentityId&&!['completed','cancelled'].includes(task.status)&&
    task.orgId===userProfile?.org_id&&isAppointedOfficeHead(userProfile,orgs);
  if(!budget)return <span>Budget unavailable</span>;
  if(budget.loading&&!open)return <span role="status">Loading budget…</span>;
  if(budget.error&&!open)return <button onClick={()=>void budget.refresh()}>Retry budget</button>;
  return <>
    <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] hover:bg-muted" aria-label={`Budget for ${task.title}`} onClick={()=>setOpen(true)}>
      <WalletCards size={15}/><span>{allocations.length?peso.format(amount):canFund?'Set budget':'Not funded'}{!allocations.length&&!!task.budgetImpact&&<small className="block text-muted-foreground">{peso.format(task.budgetImpact)} from plan</small>}</span>
    </button>
    {open&&<FeatureDialog title={`Budget for ${task.title}`} description={`FY ${getCurrentFiscalYear()} · Approved funding reserves Office Budget. Cash requests use this task's remaining pool.`} onClose={()=>setOpen(false)} contentClassName="max-w-2xl">
      <header className="border-b p-5 pr-12"><h2 className="text-lg font-semibold">Budget · {task.title}</h2><p className="mt-1 text-sm text-muted-foreground">FY {getCurrentFiscalYear()} · Authorizing funding reserves the Office Budget once.</p></header>
      <div className="min-h-0 overflow-y-auto p-5">
      {budget.loading&&<p role="status">Refreshing Office Budget. Your draft is kept.</p>}
      {budget.error&&<p role="alert">{budget.error} <button onClick={()=>void budget.refresh()}>Retry budget</button></p>}
      <fieldset disabled={budget.loading||!!budget.error}>
      {allocations.length?<div className="space-y-3"><p className="text-lg font-semibold">{peso.format(amount)} authorized</p><p>This amount is already reserved from the Office Budget. Requesting or releasing cash does not reserve it a second time.</p><p className="text-sm text-muted-foreground">Funding adjustments remain in Office Budget so existing requests, receipts and audit history stay reconciled.</p></div>
        :budget.summary?.status!=='locked'?<p>Save and lock the annual Office Budget before authorizing this task.</p>
        :canFund?<DirectWorkFunding data={budget} tasks={[task]} onChanged={budget.refresh}/>
        :<p>No authorized funding. Ask the appointed Head of the responsible Office to set this budget.</p>}
      </fieldset></div>
    </FeatureDialog>}
  </>;
}
