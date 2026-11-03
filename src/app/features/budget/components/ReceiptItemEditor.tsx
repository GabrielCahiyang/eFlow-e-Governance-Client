import { Plus, Trash2 } from "lucide-react";
import { MoneyInput } from '../../../components/ui/MoneyInput';
import type { CashFundingLine, ReceiptItem } from "../types";
import {MAX_RECEIPT_QUANTITY,receiptItemError} from '../validation/financialValidation';

export function ReceiptItemEditor({items,sources,onChange,disabled}:{items:ReceiptItem[];sources:CashFundingLine[];onChange:(items:ReceiptItem[])=>void;disabled:boolean}) {
  const patch=(id:string,value:Partial<ReceiptItem>)=>onChange(items.map(i=>i.id===id?{...i,...value}:i));
  const field="mt-1 h-9 w-full rounded-md border border-input bg-background px-2.5 text-[12px]";
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/70 bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-foreground">Purchased items <span className="font-normal text-muted-foreground">· Actual cost is the total paid for this item.</span></p>
      </div>
      {items.map((item,index)=>(
        <div key={item.id} className="space-y-2.5 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Item {index + 1}</span>
            <button
              type="button"
              aria-label={`Remove item ${index + 1}`}
              disabled={disabled}
              onClick={()=>onChange(items.filter(i=>i.id!==item.id))}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            >
              <Trash2 size={12} />
              <span>Remove</span>
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-medium text-muted-foreground">Quantity<input aria-invalid={!!receiptItemError(item)} disabled={disabled} type="number" min="0.001" max={MAX_RECEIPT_QUANTITY} step="0.001" value={Number.isNaN(item.quantity)?'':item.quantity} onChange={e=>patch(item.id,{quantity:e.target.value===''?NaN:Number(e.target.value)})} className={field}/></label>
            <label className="text-[11px] font-medium text-muted-foreground">Unit<input disabled={disabled} value={item.unit} onChange={e=>patch(item.id,{unit:e.target.value})} placeholder="pcs., rms., box" className={field}/></label>
            <label className="text-[11px] font-medium text-muted-foreground sm:col-span-2">Particulars<input disabled={disabled} value={item.particular} onChange={e=>patch(item.id,{particular:e.target.value})} className={field}/></label>
            <label className="text-[11px] font-medium text-muted-foreground">Actual cost<MoneyInput disabled={disabled} min="0.01" step="0.01" value={item.amount||""} onValueChange={raw => patch(item.id,{amount:Number(raw)})} className={`${field} text-right tabular-nums`}/></label>
            <label className="text-[11px] font-medium text-muted-foreground">Approved expense source<select disabled={disabled} value={item.allocationLineId} onChange={e=>patch(item.id,{allocationLineId:e.target.value})} className={field}>{sources.map((s,i)=><option key={s.allocationLineId} value={s.allocationLineId}>{s.sourceName||`Funding line ${i+1}`} · ₱{s.amount.toLocaleString()}</option>)}</select></label>
            <label className="text-[11px] font-medium text-muted-foreground sm:col-span-2">Purpose<input disabled={disabled} value={item.purpose} onChange={e=>patch(item.id,{purpose:e.target.value})} className={field}/></label>
            {receiptItemError(item)&&<p role="alert" className="text-xs text-destructive sm:col-span-2">Item {index+1}: {receiptItemError(item)}</p>}
          </div>
        </div>
      ))}
      <button type="button" disabled={disabled} onClick={()=>onChange([...items,{id:crypto.randomUUID(),allocationLineId:sources[0]?.allocationLineId||"",quantity:1,unit:"pcs.",particular:"",purpose:items[0]?.purpose||"",amount:0}])} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50"><Plus size={13} /> Add purchased item</button>
    </div>
  );
}
