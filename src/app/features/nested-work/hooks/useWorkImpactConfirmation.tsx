import {useState,type ReactNode} from 'react';
import {useConfirmation} from '../../../components/ui/useConfirmation';
import {WorkImpactSummary,workImpactBlockers} from '../components/WorkImpactSummary';
import {fetchWorkImpact} from '../services/workTreeService';
import type {WorkImpact,WorkRequest} from '../types';

export function useWorkImpactConfirmation(rootId:string){
 const [impact,setImpact]=useState<WorkImpact>(),confirmation=useConfirmation();
 async function review(request:WorkRequest,options:{title:string;actionLabel:string;description:string;danger?:boolean;dateChange?:boolean;alwaysConfirm?:boolean;showSummary?:boolean;details?:ReactNode|((impact:WorkImpact)=>ReactNode);isCurrent?:()=>boolean}){
  const preview=await fetchWorkImpact(rootId,request);
  if(options.isCurrent&&!options.isCurrent())throw new Error('Work or authority changed while checking impact. Review current work again.');
  setImpact(preview);
  if(preview.current_revision!==request.revision)throw new Error('Work changed. Reload and review the current work before confirming.');
  if(options.dateChange&&preview.allowed){
   if(typeof preview.requires_date_confirmation!=='boolean'||!preview.date_impact)throw new Error('Date impact confirmation is not installed on this server yet.');
   if(preview.allowed&&!preview.requires_date_confirmation&&!options.alwaysConfirm)return preview.fingerprint;
  }
  const details=typeof options.details==='function'?options.details(preview):options.details;
  const accepted=await confirmation.confirm({...options,blockers:workImpactBlockers(preview),impact:<>{options.showSummary!==false&&<WorkImpactSummary impact={preview}/>} {details}</>});
  if(accepted&&options.isCurrent&&!options.isCurrent())throw new Error('Work or authority changed during confirmation. Review current work again.');
  return accepted&&preview.allowed?preview.fingerprint:null;
 }
 return {impact,review,dialog:confirmation.dialog};
}
