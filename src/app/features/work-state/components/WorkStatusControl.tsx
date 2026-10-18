import {useRef} from 'react';
import {ChevronDown} from 'lucide-react';
import {ActionMenu} from '../../../components/ui/workspace';
import {workStateLabel} from '../selectors';
/** Opening evidence never completes work; the existing page owns validation. */
export function WorkStatusControl({status,stuck,disabled=false,onStart,onBlocker,onSubmit}:{status:string;stuck?:boolean;disabled?:boolean;onStart?:()=>void;onBlocker?:()=>void;onSubmit?:()=>void}){
 const pending=useRef<(()=>void)|undefined>(undefined);
 const choose=(callback:()=>void)=>{pending.current=callback;};
 const closed=['for_review','completed','cancelled','pending_assignment'].includes(status);
 return <ActionMenu onCloseAutoFocus={event=>{if(pending.current){event.preventDefault();const callback=pending.current;pending.current=undefined;requestAnimationFrame(callback);}}} trigger={<button type="button" className={`work-status-trigger work-status-trigger--${stuck?'stuck':status}`} disabled={disabled||closed} aria-label={`Update work status: ${workStateLabel(status,stuck)}`}>{workStateLabel(status,stuck)}<ChevronDown size={14}/></button>} actions={[
  ...(onStart?[{id:'start',label:status==='todo'?'Start work':'In progress',onSelect:()=>choose(onStart)}]:[]),
  ...(onBlocker?[{id:'blocker',label:'Stuck — add a reason',onSelect:()=>choose(onBlocker)}]:[]),
  ...(onSubmit?[{id:'submit',label:'Submit finished work',onSelect:()=>choose(onSubmit)}]:[])
 ]}/>;
}
