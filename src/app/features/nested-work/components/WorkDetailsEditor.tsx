import {WorkPeoplePicker} from './WorkPeoplePicker';
import {useState,type ComponentProps} from 'react';
import type {WorkEditorFields} from '../types/editor';
import {getPhilippineCalendarDate} from '../../../shared/calendarDates';
import {CalendarDays, ChevronDown, ListPlus, UsersRound} from 'lucide-react';

export interface WorkDetailsEditorProps {
 fields:WorkEditorFields;disabled:boolean;maxDue?:string;minDue?:string;showStart?:boolean;presentation?:'default'|'dialog';
 update:<K extends keyof WorkEditorFields>(key:K,value:WorkEditorFields[K])=>void;
 peoplePicker?:ComponentProps<typeof WorkPeoplePicker>;
}
export function WorkDetailsEditor({fields,disabled,maxDue,minDue=getPhilippineCalendarDate(),update,peoplePicker,showStart=false,presentation='default'}:WorkDetailsEditorProps){
 const dialog=presentation==='dialog';const [peopleOpen,setPeopleOpen]=useState(false);
 const title=<label>Subtask title<input value={fields.title} maxLength={200} required disabled={disabled} placeholder={dialog?'What needs to be done?':undefined} onChange={event=>update('title',event.target.value)}/></label>;
 const start=showStart?<label>Subtask start date<input type="date" value={fields.start||''} min={minDue||undefined} max={maxDue} disabled={disabled} onChange={event=>update('start',event.target.value)}/></label>:null;
 const due=<label>Subtask due date<input type="date" value={fields.due} min={fields.start||minDue||undefined} max={maxDue} disabled={disabled} onChange={event=>update('due',event.target.value)}/></label>;
 const mode=<label>Execution mode<select value={fields.standalone?'independent':'sequence'} disabled={disabled} onChange={event=>update('standalone',event.target.value==='independent')}>
   <option value="sequence">In sequence</option><option value="independent">Can start independently</option>
  </select></label>;
 return <>
  {dialog?<section className="nw-create-details" aria-label="Subtask details"><div className="nw-create-section-title"><ListPlus size={18} aria-hidden="true"/><h3>Subtask details</h3></div>{title}<div className="nw-create-schedule">{start}{due}</div>{mode}<p className="nw-create-hint"><CalendarDays size={15} aria-hidden="true"/>{fields.standalone?'This step can start independently.':'This step waits for earlier steps to be completed.'}</p></section>:<>{title}{start}{due}{mode}</>}
  {peoplePicker&&<details open={peopleOpen} className={dialog?'nw-create-team':undefined}><summary onClick={event=>{event.preventDefault();setPeopleOpen(value=>!value);}}>{dialog?<><UsersRound size={18} aria-hidden="true"/><span><strong>Assign people</strong><small>Optional · choose a lead and contributors</small></span><ChevronDown size={17} className="nw-create-chevron" aria-hidden="true"/></>:'Advanced: Lead and contributors (optional)'}</summary>{dialog&&<p className="nw-create-hint">You can add people now or assign this step later.</p>}{peopleOpen&&<WorkPeoplePicker {...peoplePicker}/>}</details>}
 </>;
}
