import {WorkPeoplePicker} from './WorkPeoplePicker';
import type {ComponentProps} from 'react';
import type {WorkEditorFields} from '../types/editor';
import {getPhilippineCalendarDate} from '../../../shared/calendarDates';

export interface WorkDetailsEditorProps {
 fields:WorkEditorFields;disabled:boolean;maxDue?:string;minDue?:string;
 update:<K extends keyof WorkEditorFields>(key:K,value:WorkEditorFields[K])=>void;
 peoplePicker?:ComponentProps<typeof WorkPeoplePicker>;
}
export function WorkDetailsEditor({fields,disabled,maxDue,minDue=getPhilippineCalendarDate(),update,peoplePicker}:WorkDetailsEditorProps){
 return <>
  <label>Subitem title<input value={fields.title} maxLength={200} required disabled={disabled} onChange={event=>update('title',event.target.value)}/></label>
  <label>Subitem due date<input type="date" value={fields.due} min={minDue} max={maxDue} disabled={disabled} onChange={event=>update('due',event.target.value)}/></label>
  <label>Execution mode<select value={fields.standalone?'independent':'sequence'} disabled={disabled} onChange={event=>update('standalone',event.target.value==='independent')}>
   <option value="sequence">In sequence</option><option value="independent">Can start independently</option>
  </select></label>
  {peoplePicker&&<details><summary>Advanced: Lead and contributors (optional)</summary><WorkPeoplePicker {...peoplePicker}/></details>}
 </>;
}
