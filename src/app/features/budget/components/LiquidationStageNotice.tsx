import {CheckCircle2,Clock3,ShieldAlert} from 'lucide-react';
import type {PettyCashLiquidation,PettyCashRequest} from '../types';
import {liquidationStage} from '../selectors/liquidationStage';

export function LiquidationStageNotice({request,liquidation}:{request:PettyCashRequest;liquidation?:PettyCashLiquidation}){
  const stage=liquidationStage(request,liquidation);
  if(!stage)return null;
  const Icon=stage.tone==='success'?CheckCircle2:stage.tone==='error'?ShieldAlert:Clock3;
  const color=stage.tone==='success'?'border-emerald-200 bg-emerald-50 text-emerald-800':stage.tone==='error'?'border-rose-300 bg-rose-50 text-rose-800':'border-amber-200 bg-amber-50 text-amber-900';
  return <div role={stage.tone==='error'?'alert':'status'} className={`mt-2 flex items-start gap-2 rounded-lg border p-3 text-xs ${color}`}><Icon size={15} className="mt-0.5 shrink-0"/><div><strong className="block">{stage.title}</strong><p className="mt-1 leading-relaxed">{stage.detail}</p></div></div>;
}
