import {useEffect,useRef,useState} from 'react';
import {MutationRejectedError} from '../../../shared/MutationRejectedError';
import type {WorkUpdate} from '../../work-state';
import {saveSubtaskWorkUpdate} from '../services/subtaskWorkflowService';

/** Direct updates have no idempotency receipt. Never replay an uncertain write. */
export function useSubtaskProgressSave(subtaskId:string,onSaved:()=>void|Promise<void>,recheck?:()=>Promise<void>) {
 const attempted=useRef(false),[blocked,setBlocked]=useState(false),[message,setMessage]=useState('');
 const active=useRef(true),checking=useRef(false),baselineCheck=useRef(recheck),latestCheck=useRef(recheck);
 latestCheck.current=recheck;
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const save=async(input:WorkUpdate)=>{
  if(attempted.current||checking.current)throw new Error('Reload this subtask to verify the previous update before posting again.');
  checking.current=true;
  try{if(baselineCheck.current)await baselineCheck.current();}finally{checking.current=false;}
  if(!active.current)throw new Error('Reopen this subtask before posting an update.');
  attempted.current=true;setBlocked(true);setMessage('');
  try{
   await saveSubtaskWorkUpdate({subtaskId,state:input.state,blocker:input.blocker,note:input.note,nextStep:input.nextStep,attachment:input.files[0]});
  }catch(reason){
   if(reason instanceof MutationRejectedError){attempted.current=false;setBlocked(false);throw reason;}
   setMessage('The update could not be confirmed. Reload this subtask and check its work history before posting again.');
   throw reason;
  }
  try{await onSaved();baselineCheck.current=latestCheck.current;attempted.current=false;setBlocked(false);}
  catch{setMessage('Your update was saved, but this view could not refresh. Reload this subtask before posting again.');}
 };
 return {save,blocked,message};
}
