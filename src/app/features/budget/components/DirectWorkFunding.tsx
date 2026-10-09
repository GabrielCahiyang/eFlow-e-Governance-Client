import { useRef, useState } from "react";
import type { Task } from "../../tasks";
import type { DepartmentBudgetBundle } from "../types";
import { sectionLeaves, moneyCents } from "../selectors/budgetSections";
import { isOpenDirectFundingWork } from "../selectors/directFundingEligibility";
import { fundOfficeWork, type DirectFundingLine } from "../services/directFundingService";
import { useConfirmation } from "../../../components/ui/useConfirmation";
import { useExplicitDraft } from "../../../shared/useExplicitDraft";
import { peso } from "./budgetUi";

export function DirectWorkFunding({ data,tasks,onChanged }: { data:DepartmentBudgetBundle; tasks:Task[]; onChanged:()=>Promise<void> }) {
  const [taskId,setTaskId]=useState(tasks.length===1?tasks[0].id:"");
  const [lines,setLines]=useState<DirectFundingLine[]>([{partitionId:"",amount:0,particular:""}]);
  const [reason,setReason]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const pending=useRef(false),key=useRef(crypto.randomUUID());
  const confirmation=useConfirmation();
  const draft=useExplicitDraft("Work funding authorization",Boolean(reason||lines.some(l=>l.amount||l.partitionId||l.particular)),busy,()=>{setReason("");setLines([{partitionId:"",amount:0,particular:""}]);});
  const leaves=sectionLeaves(data.sections||[]);
  const total=lines.reduce((sum,l)=>sum+(Number.isFinite(l.amount)&&l.amount<=90_000_000_000?moneyCents(l.amount||0):0),0)/100;
  const availableTasks=tasks.filter(t=>isOpenDirectFundingWork(t)&&!data.allocations.some(a=>a.taskId===t.id&&!a.subtaskId&&a.status==="approved"));
  const valid=taskId&&availableTasks.some(t=>t.id===taskId)&&reason.trim()&&lines.length&&lines.every(l=>l.partitionId&&l.amount>0)&&new Set(lines.map(l=>l.partitionId)).size===lines.length;
  const submit=async()=>{
    if(pending.current||!valid||!data.summary) return;
    pending.current=true;draft.pendingRef.current=true;setBusy(true);setMessage("");
    try {
      if(!await confirmation.confirm({title:"Authorize funding for this work?",description:`FY ${data.summary.fiscalYear}: ${peso.format(total)}. This charges the selected annual accounts once. Planning estimates do not approve money. Authority: ${reason}`,actionLabel:"Authorize funding"})) return;
      await fundOfficeWork({taskId,fiscalYear:data.summary.fiscalYear,lines,reason,authorizationKey:key.current});
      draft.markClean();setReason("");setLines([{partitionId:"",amount:0,particular:""}]);key.current=crypto.randomUUID();setMessage("Work funding authorized.");await onChanged();
    } catch(e) {setMessage(e instanceof Error?e.message:"Funding could not be authorized. Refresh before retrying.");}
    finally {pending.current=false;draft.pendingRef.current=false;setBusy(false);}
  };
  if(data.summary?.status!=="locked"||!data.sectionsAvailable) return null;
  return <section className="rounded-xl border border-border bg-card p-4">
    {confirmation.dialog}<h3 className="text-[14px] font-semibold">Fund current work</h3>
    <p className="mt-1 text-[12px] text-muted-foreground">For manually created or imported work. Select real annual accounts and the approved authority reference.</p>
    <label className="mt-3 block text-[12px]">Work<select disabled={busy} value={taskId} onChange={e=>setTaskId(e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3"><option value="">Select unfunded work</option>{availableTasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
    {lines.map((l,i)=><div key={i} className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
      <label className="text-[12px]">Annual account<select disabled={busy} value={l.partitionId} onChange={e=>setLines(current=>current.map((x,j)=>j===i?{...x,partitionId:e.target.value}:x))} className="mt-1 h-10 w-full rounded-lg border px-2"><option value="">Choose account</option>{leaves.map(s=><option key={s.id} value={s.id}>{s.name} · {peso.format(s.amount-s.heldAmount-(s.committedAmount||0))} available</option>)}</select></label>
      <label className="text-[12px]">Approved amount<input disabled={busy} min="0" step="0.01" type="number" value={l.amount||""} onChange={e=>setLines(current=>current.map((x,j)=>j===i?{...x,amount:Number(e.target.value)}:x))} className="mt-1 h-10 w-full rounded-lg border px-3 text-right" /></label>
      <button type="button" disabled={busy} onClick={()=>setLines(current=>current.filter((_,j)=>j!==i))} className="self-end rounded-lg border p-2 text-[12px]">Remove</button>
    </div>)}
    <button type="button" disabled={busy} onClick={()=>setLines(current=>[...current,{partitionId:"",amount:0,particular:""}])} className="mt-3 rounded-lg border px-3 py-2 text-[12px]">Add funding account</button>
    <label className="mt-3 block text-[12px]">Reason / approved authority reference<textarea disabled={busy} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><strong className="text-[14px]">Funding total: {peso.format(total)}</strong><button disabled={busy||!valid} onClick={()=>void submit()} className="rounded-lg bg-primary px-4 py-2 text-[12px] text-primary-foreground disabled:opacity-40">Authorize work funding</button></div>
    {message&&<p role="status" className="mt-3 text-[12px]">{message}</p>}
  </section>;
}
