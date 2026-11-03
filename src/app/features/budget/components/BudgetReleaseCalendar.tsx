import {useRef,useState} from 'react';
import {CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,Clock3} from 'lucide-react';
import {DecisionModal} from '../../../components/ui/DecisionModal';
import {useAuth} from '../../../contexts/AuthContext';
import {useToast} from '../../../components/ui/Toast';
import {getPhilippineCalendarDate} from '../../../shared/calendarDates';
import {confirmOfficeBudgetRelease} from '../services/budgetSectionService';
import type {BudgetScheduledRelease,BudgetSection,DepartmentBudgetBundle} from '../types';
import {peso} from './budgetUi';
import './budgetReleaseCalendar.css';

export function BudgetReleaseCalendar({data,onChanged}:{data:DepartmentBudgetBundle;onChanged:()=>Promise<void>}){
 const {userProfile}=useAuth(),{toast}=useToast();
 const year=data.summary?.fiscalYear||Number(getPhilippineCalendarDate().slice(0,4));
 const [month,setMonth]=useState(()=>Number(getPhilippineCalendarDate().slice(5,7))-1);
 const [day,setDay]=useState('');
 const [selected,setSelected]=useState<{account:BudgetSection;release:BudgetScheduledRelease}|null>(null);
 const pending=useRef(false);
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!data.releaseScheduleAvailable)return null;
 const releases=(data.sections||[]).filter(a=>!a.retired).flatMap(account=>(account.releaseSchedule||[]).map(release=>({account,release}))).sort((a,b)=>a.release.date.localeCompare(b.release.date));
 if(!releases.length)return null;
 const prefix=`${year}-${String(month+1).padStart(2,'0')}`;
 const visible=releases.filter(r=>r.release.date.startsWith(prefix)&&(!day||r.release.date===day));
 const firstDay=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate();
 const canConfirm=data.canConfirmBudgetReleases===true&&userProfile?.role==='accounting_staff'&&userProfile.org_id===data.summary?.orgId&&data.summary?.status==='locked';
 const today=getPhilippineCalendarDate();
 async function confirm(){
  if(!selected||pending.current||!canConfirm)return;
  pending.current=true;
  setBusy(true);setError('');
  try{
   await confirmOfficeBudgetRelease(selected.account.id,selected.release.id,data.sectionsVersion||0,reason);
   setSelected(null);toast('Budget release confirmed. The amount is now available.','success');
   try{await onChanged();}catch{toast('Release saved. Could not load the latest budget.','warning');}
  }catch(caught){setError(caught instanceof Error?caught.message:'Could not confirm this release.');}
  finally{pending.current=false;setBusy(false);}
 }
 return <section className="budget-release-calendar" aria-label="Office budget release calendar"><header><div><h3><CalendarDays size={21}/>Budget release calendar</h3><p>Scheduled money stays on hold until Accounting confirms availability. This does not release physical cash.</p></div><span className="budget-release-status"><Clock3 size={14}/>{peso.format(releases.filter(r=>r.release.status==='pending').reduce((n,r)=>n+r.release.amount,0))} pending</span></header>
 <div className="budget-release-calendar__layout"><div className="budget-release-calendar__month"><nav aria-label="Release calendar month"><button type="button" aria-label="Previous release month" disabled={month===0} onClick={()=>{setMonth(m=>m-1);setDay('');}}><ChevronLeft size={19}/></button><strong>{new Date(year,month,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Next release month" disabled={month===11} onClick={()=>{setMonth(m=>m+1);setDay('');}}><ChevronRight size={19}/></button></nav><div className="budget-release-calendar__grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span className="budget-release-calendar__weekday" key={d}>{d}</span>)}{Array.from({length:firstDay},(_,i)=><span key={`blank-${i}`}/>)}{Array.from({length:days},(_,i)=>{const date=`${prefix}-${String(i+1).padStart(2,'0')}`,scheduled=releases.filter(r=>r.release.date===date);return <button key={date} type="button" aria-label={`Show releases for ${date}`} aria-pressed={day===date} data-today={today===date} data-scheduled={scheduled.length>0} onClick={()=>setDay(day===date?'':date)}>{i+1}{!!scheduled.length&&<i aria-hidden="true"/>}</button>;})}</div><button type="button" className="budget-release-calendar__all" onClick={()=>setDay('')}>Show all releases this month</button></div>
 <div className="budget-release-calendar__list"><h4>{day?`Releases on ${day}`:'This month’s releases'}</h4>{visible.length?visible.map(({account,release})=><article key={`${account.id}:${release.id}`}><div><strong>{account.name}</strong><small>{release.date}</small><span className="budget-release-status" data-status={release.status}>{release.status==='confirmed'?<CheckCircle2 size={14}/>:<Clock3 size={14}/>} {release.status==='confirmed'?'Confirmed':release.date>today?'Scheduled':'Awaiting Accounting'}</span>{release.confirmedByName&&<small>Confirmed by {release.confirmedByName}{release.reference?` · ${release.reference}`:''}</small>}</div><div className="budget-release-calendar__amount"><strong>{peso.format(release.amount)}</strong>{canConfirm&&release.status==='pending'&&<button type="button" disabled={release.date>today||busy} onClick={()=>{setSelected({account,release});setReason('');setError('');}}>Confirm availability</button>}</div></article>):<p className="budget-release-calendar__empty">No releases scheduled {day?'for this date':'this month'}.</p>}</div></div>
 {selected&&<DecisionModal title="Confirm budget availability?" description={<>Make <strong>{peso.format(selected.release.amount)}</strong> available from <strong>{selected.account.name}</strong>? This records budget availability only.</>} reason={reason} onReasonChange={setReason} reasonLabel="Release reference or note" maxReasonLength={1000} requireReason busy={busy} error={error} onCancel={()=>{if(!busy)setSelected(null);}} confirmLabel="Yes, confirm availability" onConfirm={()=>void confirm()}/>}
 </section>;
}
