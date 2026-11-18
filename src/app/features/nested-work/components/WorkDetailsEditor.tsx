import {WorkPeoplePicker} from './WorkPeoplePicker';
import type {ComponentProps} from 'react';
import type {WorkEditorFields} from '../types/editor';
import {getPhilippineCalendarDate} from '../../../shared/calendarDates';
import {CalendarDays, ListPlus, UsersRound} from 'lucide-react';
import { DateInput } from '../../../components/ui/DateInput';

export interface WorkDetailsEditorProps {
 fields:WorkEditorFields;disabled:boolean;maxDue?:string;minDue?:string;showStart?:boolean;presentation?:'default'|'dialog';planningLocked?:boolean;dueDisabled?:boolean;staffingLocked?:boolean;
 update:<K extends keyof WorkEditorFields>(key:K,value:WorkEditorFields[K])=>void;
 peoplePicker?:ComponentProps<typeof WorkPeoplePicker>;
}
export function WorkDetailsEditor({fields,disabled,maxDue,minDue=getPhilippineCalendarDate(),update,peoplePicker,showStart=false,presentation='default',planningLocked=false,dueDisabled=false,staffingLocked=false}:WorkDetailsEditorProps){
 const dialog=presentation==='dialog';
 const title=<label>Subtask title<input value={fields.title} maxLength={200} disabled={disabled} placeholder={dialog?'What needs to be done?':undefined} onChange={event=>update('title',event.target.value)}/></label>;
 const start=showStart?<label>Subtask start date<DateInput value={fields.start||''} min={minDue||undefined} max={maxDue} disabled={disabled||planningLocked} onChange={event=>update('start',event.target.value)}/></label>:null;
 const due=<label>Subtask due date<DateInput value={fields.due} min={fields.start||minDue||undefined} max={maxDue} disabled={disabled||dueDisabled} onChange={event=>update('due',event.target.value)}/></label>;
 const priority=<label>Priority<select value={fields.priority||'medium'} disabled={disabled} onChange={event=>update('priority',event.target.value as 'low'|'medium'|'high')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>;
 const mode=<label>Work order<select value={fields.standalone?'independent':'sequence'} disabled={disabled||planningLocked} onChange={event=>update('standalone',event.target.value==='independent')}>
   <option value="sequence">In sequence</option><option value="independent">Can start out of order</option>
  </select></label>;
 return <>
  {dialog?<section className="nw-create-details" aria-label="Subtask details"><div className="nw-create-section-title"><ListPlus size={18} aria-hidden="true"/><h3>Subtask details</h3></div>{title}<div className="nw-create-schedule">{start}{due}</div>{mode}<p className="nw-create-hint"><CalendarDays size={15} aria-hidden="true"/>{fields.standalone?'This subtask can start without waiting for earlier steps. Its start date and other requirements still apply.':'Finish earlier steps before starting this subtask.'}</p></section>:<>{title}{priority}{start}{due}{mode}</>}
  {peoplePicker&&<section className={dialog?'nw-create-team':'nw-create-team'} aria-label="Subtask Lead and contributors"><div className="nw-create-team__header"><UsersRound size={18} aria-hidden="true"/><span><strong>Subtask Lead and contributors</strong><small>Optional</small></span></div><WorkPeoplePicker {...peoplePicker}/></section>}
  {dialog&&staffingLocked&&<p className="nw-create-team-locked" role="status"><UsersRound size={16} aria-hidden="true"/><span><strong>Lead and contributors:</strong> Managed by the Task Lead while this project is active. This subtask starts unassigned.</span></p>}
 </>;
}
