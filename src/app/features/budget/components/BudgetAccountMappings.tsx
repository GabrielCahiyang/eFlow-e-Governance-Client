import { useEffect,useState } from "react";
import type { AccountingAccount,DepartmentBudgetBundle } from "../types";
import { fetchAccountingAccounts } from "../services/budgetService";
import { mapOfficeBudgetAccount } from "../services/pettyCashVoucherService";
import { sectionLeaves } from "../selectors/budgetSections";
export function BudgetAccountMappings({data,onChanged}:{data:DepartmentBudgetBundle;onChanged:()=>Promise<void>}) {
  const [accounts,setAccounts]=useState<AccountingAccount[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{let active=true;void fetchAccountingAccounts().then(rows=>{if(active)setAccounts(rows.filter(a=>a.classification==="expense"));}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[]);
  const map=async(id:string,code:string)=>{if(!code||busy)return;setBusy(true);setMessage("");try{await mapOfficeBudgetAccount(id,code);await onChanged();setMessage("Journal account mapping recorded.");}catch(e){setMessage(e instanceof Error?e.message:"Mapping could not be saved.");}finally{setBusy(false);}};
  if(!data.sectionsAvailable||!(data.sections||[]).some(s=>'journalAccountCode' in s)||data.summary?.status==='closed')return null;
  return <section className="rounded-xl border border-border bg-card p-4"><h3 className="text-[14px] font-semibold">Expense-account mapping</h3><p className="mt-1 text-[12px] text-muted-foreground">Map each budget source to an approved account in the journal catalog. A photo's printed code is only a label; mixed-account settlement cannot silently use a generic account.</p><div className="mt-3 space-y-2">{sectionLeaves(data.sections||[]).map(s=><label key={s.id} className="grid items-center gap-2 text-[12px] sm:grid-cols-2"><span>{s.name} {s.accountCode?`(${s.accountCode})`:''}</span><select disabled={busy} value={s.journalAccountCode||""} onChange={e=>void map(s.id,e.target.value)} className="h-10 rounded-lg border px-3"><option value="">Not mapped · settlement blocked</option>{accounts.map(a=><option key={a.code} value={a.code}>{a.code} · {a.title}</option>)}</select></label>)}</div>{message&&<p role="status" className="mt-3 text-[12px]">{message}</p>}</section>;
}
