import {useRef} from 'react';
import {ChevronDown} from 'lucide-react';
import {ActionMenu} from '../../../components/ui/workspace';
import {useWorkStatus} from '../../work-status';
import {workStateLabel} from '../selectors';
/** Opening evidence never completes work; the existing page owns validation. */
export function WorkStatusControl({status,stuck,customStatusId,disabled=false,onStart,onBlocker,onSubmit}:{status:string;stuck?:boolean;customStatusId?:string;disabled?:boolean;onStart?:()=>void;onBlocker?:()=>void;onSubmit?:()=>void}){
 const display=useWorkStatus(stuck?'stuck':status,workStateLabel(status,stuck),customStatusId);
 const pending=useRef<(()=>void)|undefined>(undefined);
 const choose=(callback:()=>void)=>{pending.current=callback;};
 const closed=['for_review','completed','cancelled','pending_assignment'].includes(status);
 return <ActionMenu onCloseAutoFocus={event=>{if(pending.current){event.preventDefault();const callback=pending.current;pending.current=undefined;requestAnimationFrame(callback);}}} trigger={<button type="button" className={`work-status-trigger work-status-trigger--${stuck?'stuck':status}`} disabled={disabled||closed} style={display.color ? {boxShadow: `inset 3px 0 ${display.color}`} : undefined} aria-label={`Update work status: ${display.label}`}>{display.label}<ChevronDown size={14}/></button>} actions={[
  ...(onStart?[{id:'start',label:status==='todo'?'Start work':'In progress',onSelect:()=>choose(onStart)}]:[]),
  ...(onBlocker?[{id:'blocker',label:'Stuck — add a reason',onSelect:()=>choose(onBlocker)}]:[]),
  ...(onSubmit?[{id:'submit',label:'Submit finished work',onSelect:()=>choose(onSubmit)}]:[])
 ]}/>;
}
