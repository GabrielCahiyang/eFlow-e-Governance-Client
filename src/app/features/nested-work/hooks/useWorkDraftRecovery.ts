import {useState} from 'react';
import type {WorkCapabilityContext,WorkTreeSnapshot} from '../types';
import type {WorkEditorBaseline} from '../types/editor';
import {readWorkDrafts,removeWorkDraft,workDraftIdentity,writeWorkDraft,type WorkDraftRecord} from '../services/workDraftStore';

/** A stored draft supplies form state only; fresh response capability remains authoritative. */
export function useWorkDraftRecovery(data:WorkTreeSnapshot,context:WorkCapabilityContext,baseline:WorkEditorBaseline,mode:string=baseline.command,revision?:number) {
 const [initial]=useState(()=>readWorkDrafts(data,context).find(record=>(revision===undefined||record.baseline.revision===revision)&&workDraftIdentity(record.baseline,record.mode)===workDraftIdentity(baseline,mode)));
 const [storageFailed,setStorageFailed]=useState(false);
 const actual=initial?.baseline||baseline;
 return {initial,baseline:actual,recovered:!!initial,stale:!!initial&&actual.revision!==data.revision,storageFailed,
  persist:(record:Omit<WorkDraftRecord,'version'|'mode'>)=>{const stored=writeWorkDraft({version:1,mode,...record});setStorageFailed(!stored);return stored;},
  clear:()=>removeWorkDraft({version:1,mode,baseline:actual,fields:initial?.fields||actual.fields})};
}
