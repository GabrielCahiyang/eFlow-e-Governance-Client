import type { CashFundingLine, ReceiptItem } from "../types";
export function ReceiptItemEditor({items,sources,onChange,disabled}:{items:ReceiptItem[];sources:CashFundingLine[];onChange:(items:ReceiptItem[])=>void;disabled:boolean}) {
  const patch=(id:string,value:Partial<ReceiptItem>)=>onChange(items.map(i=>i.id===id?{...i,...value}:i));
  const field="h-9 w-full rounded-lg border px-2 text-[12px]";
  return <div className="mt-3 space-y-3 rounded-lg bg-muted/30 p-3">
    <p className="text-[12px] font-medium">Purchased items · Amount is the whole item row, not unit cost</p>
    {items.map((item,index)=><div key={item.id} className="grid gap-2 sm:grid-cols-2">
      <label className="text-[11px]">Quantity<input disabled={disabled} type="number" min="0.001" step="0.001" value={item.quantity} onChange={e=>patch(item.id,{quantity:Number(e.target.value)})} className={field}/></label>
      <label className="text-[11px]">Unit<input disabled={disabled} value={item.unit} onChange={e=>patch(item.id,{unit:e.target.value})} placeholder="pcs., rms., box" className={field}/></label>
      <label className="text-[11px] sm:col-span-2">Particulars<input disabled={disabled} value={item.particular} onChange={e=>patch(item.id,{particular:e.target.value})} className={field}/></label>
      <label className="text-[11px]">Line amount<input disabled={disabled} type="number" min="0.01" step="0.01" value={item.amount||""} onChange={e=>patch(item.id,{amount:Number(e.target.value)})} className={`${field} text-right`}/></label>
      <label className="text-[11px]">Approved expense source<select disabled={disabled} value={item.allocationLineId} onChange={e=>patch(item.id,{allocationLineId:e.target.value})} className={field}>{sources.map((s,i)=><option key={s.allocationLineId} value={s.allocationLineId}>{s.sourceName||`Funding line ${i+1}`} · ₱{s.amount.toLocaleString()}</option>)}</select></label>
      <label className="text-[11px] sm:col-span-2">Purpose<input disabled={disabled} value={item.purpose} onChange={e=>patch(item.id,{purpose:e.target.value})} className={field}/></label>
      <button type="button" disabled={disabled} onClick={()=>onChange(items.filter(i=>i.id!==item.id))} className="text-left text-[11px] text-destructive">Remove item {index+1}</button>
    </div>)}
    <button type="button" disabled={disabled} onClick={()=>onChange([...items,{id:crypto.randomUUID(),allocationLineId:sources[0]?.allocationLineId||"",quantity:1,unit:"pcs.",particular:"",purpose:items[0]?.purpose||"",amount:0}])} className="rounded-lg border px-3 py-2 text-[12px]">Add purchased item</button>
  </div>;
}
