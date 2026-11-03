import {AlertCircle} from 'lucide-react';
import type {BudgetProtection} from '../types';
import {peso} from './budgetUi';
export function BudgetProtectionAlert({protection,error}:{protection?:BudgetProtection|null;error?:Error|null}){
 if(!protection&&!error)return null;
 return <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-[13px] text-rose-800"><div className="flex items-start gap-2"><AlertCircle size={19} className="shrink-0" aria-hidden="true"/><div><strong>{protection?`Cannot reduce ${protection.account} to ${peso.format(protection.entered)}.`:'Budget was not saved'}</strong>
 {protection?<><p className="mt-1">The minimum allowed is {peso.format(protection.minimum)}. Existing project funding and spending must stay covered.</p><ul className="mt-2 space-y-1">{protection.sources.map((source,index)=><li key={`${source.id}:${index}`}>{source.name}: <strong>{peso.format(source.amount)}</strong> reserved or spent</li>)}</ul><p className="mt-2">Increase the amount or return eligible unused project funding first. Nothing has been saved.</p></>:<p className="mt-1 whitespace-pre-wrap">{error?.message}</p>}
 </div></div></div>;
}
