import type {FundingDraft} from './types';

export interface FundingDraftRecovery {
 lines:FundingDraft[];
 reason:string;
 years?:Record<number,number|undefined>;
 request?:{id:string;operation:'authorize_project_funding'|'request_project_funding'};
}

export function readFundingDraft(key:string):FundingDraftRecovery|undefined {
 if(!key)return;
 try{
  const draft=JSON.parse(localStorage.getItem(key)??'null') as FundingDraftRecovery|null;
  if(draft&&typeof draft.reason==='string'&&Array.isArray(draft.lines)&&draft.lines.length>0&&
   draft.lines.length<=100&&draft.lines.every(line=>line&&typeof line.partitionId==='string'&&Number.isFinite(line.amount))&&
   (!draft.years||typeof draft.years==='object'&&Object.values(draft.years).every(year=>Number.isInteger(year)))&&
   (!draft.request||typeof draft.request.id==='string'&&['authorize_project_funding','request_project_funding'].includes(draft.request.operation)))return draft;
 }catch{ /* Storage can be unavailable or contain an older draft. */ }
}

export function storeFundingDraft(key:string,draft?:FundingDraftRecovery):boolean {
 if(!key)return false;
 try{
  if(draft)localStorage.setItem(key,JSON.stringify(draft));
  else localStorage.removeItem(key);
  return true;
 }catch{return false;}
}
