import { EmptyState } from '../../../components/ui/EmptyState';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {fetchWorkEvents,type WorkEvent} from '../services/workTreeService';
import {isCurrentWorkSnapshot} from '../selectors/capabilities';
import {selectFocusedWorkEvents,type WorkActivityFocus} from '../selectors/workActivityScope';
import {presentWorkEvent} from '../selectors/workEventPresentation';
import type {WorkTreeSnapshot} from '../types';
import {useVisibleRead} from '../../../shared/useVisibleRead';
import {subscribeWorkChanges} from '../../../shared/workChanges';
import {getPhilippineCalendarDate} from '../../../shared/calendarDates';
import {MANILA_TIMEZONE} from '../../../shared/calendarDisplay';
import {History,ArrowUp,ArrowDown,ArrowUpDown,CalendarDays} from 'lucide-react';
import {WorkActivityCard,WorkActivityExtraCard,type WorkActivityExtraEntry} from './WorkActivityCard';
import '../workActivity.css';

export type {WorkActivityExtraEntry,WorkActivityExtraKind,WorkActivityAttachment} from './WorkActivityCard';

type ActivityDateFilter='all'|'today'|'last_7_days'|'last_30_days';
type ActivitySortOrder='newest'|'oldest';

const manilaYmdFormat=new Intl.DateTimeFormat('en-CA',{
 timeZone:MANILA_TIMEZONE,
 year:'numeric',
 month:'2-digit',
 day:'2-digit',
});

function parseTimestampMs(value?:string|number|null):number{
 if(typeof value==='number')return Number.isFinite(value)?value:0;
 if(typeof value==='string'){
  const trimmed=value.trim();
  if(!trimmed)return 0;
  if(/^\d+$/.test(trimmed)){
   const numeric=Number(trimmed);
   return Number.isFinite(numeric)?numeric:0;
  }
  const parsed=Date.parse(trimmed);
  return Number.isFinite(parsed)?parsed:0;
 }
 return 0;
}

function toManilaYmd(value?:string|number|null):string{
 const ms=parseTimestampMs(value);
 if(ms<=0)return '';
 return manilaYmdFormat.format(new Date(ms));
}

function shiftCalendarDate(ymd:string,deltaDays:number):string{
 const [y,m,d]=ymd.split('-').map(Number);
 const dt=new Date(Date.UTC(y,m-1,d+deltaDays));
 return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
}

export function WorkActivity({roots,focusedNode,snapshot,extraEntries}:{roots:string[];focusedNode?:WorkActivityFocus;snapshot?:WorkTreeSnapshot;extraEntries?:WorkActivityExtraEntry[]}){
 const {user}=useAuth();
 const verified=!focusedNode||!!snapshot&&roots.length===1&&roots[0]===focusedNode.rootId&&snapshot.nodes.some(node=>node.id===focusedNode.nodeId)&&isCurrentWorkSnapshot(snapshot,{actorId:user?.id||null,rootId:focusedNode.rootId,projectId:snapshot.root.project,officeId:snapshot.root.office,kind:snapshot.root.kind,revision:snapshot.revision});
 return verified?<Activity key={JSON.stringify([user?.id,roots,focusedNode])} roots={roots} focusedNode={focusedNode} snapshot={snapshot} extraEntries={extraEntries}/>:<p role="status">Verify current subtask access to read its work changes.</p>;
}

function Activity({roots,focusedNode,snapshot,extraEntries}:{roots:string[];focusedNode?:WorkActivityFocus;snapshot?:WorkTreeSnapshot;extraEntries?:WorkActivityExtraEntry[]}){
 const heading=useRef<HTMLHeadingElement>(null),backgroundRead=useRef<()=>void>(()=>{});
 const [events,setEvents]=useState<WorkEvent[]>([]),[more,setMore]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false),[cursor,setCursor]=useState<{time:string;id:string}>(),[retry,setRetry]=useState(0);
 const [sortOrder,setSortOrder]=useState<ActivitySortOrder>('newest');
 const [dateFilter,setDateFilter]=useState<ActivityDateFilter>('all');
 useEffect(()=>{
  let active=true,pending=false,queued=false;
  const load=async(background=false)=>{
   if(pending){queued=true;return;}
   pending=true;
   if(!background){setLoading(true);setError('');}
   try{
    const result=await fetchWorkEvents(roots,cursor);
    if(active){setEvents(result.events);setMore(result.more);setError('');}
   }catch(reason){
    if(active){setEvents([]);setMore(false);setError((reason as Error).message);}
   }finally{
    pending=false;
    if(active){setLoading(false);if(queued){queued=false;void load(true);}}
   }
  };
  void load();
  backgroundRead.current=()=>void load(true);
  const unsubscribe=cursor?undefined:subscribeWorkChanges(backgroundRead.current,roots.length===1?roots[0]:undefined);
  return()=>{active=false;backgroundRead.current=()=>{};unsubscribe?.();};
 },[cursor,retry]);
 useVisibleRead(()=>backgroundRead.current(),!cursor);
 const showPage=(next?:{time:string;id:string})=>{
  heading.current?.focus({preventScroll:true});
  setCursor(next);
 };
 const displayed=focusedNode&&snapshot?selectFocusedWorkEvents(events,focusedNode,snapshot):events.map(event=>({event}));

 type MergedItem=
  |{type:'event';id:string;occurredAt:string|number;timeMs:number;event:WorkEvent}
  |{type:'extra';id:string;occurredAt:string|number;timeMs:number;entry:WorkActivityExtraEntry};

 const mergedItems=useMemo(()=>{
  const items:MergedItem[]=[
   ...displayed.map(({event})=>({
    type:'event' as const,
    id:`event:${event.id}`,
    occurredAt:event.occurred_at,
    timeMs:parseTimestampMs(event.occurred_at),
    event,
   })),
   ...(!cursor?(extraEntries??[]).map(entry=>({
    type:'extra' as const,
    id:`extra:${entry.id}`,
    occurredAt:entry.occurredAt,
    timeMs:parseTimestampMs(entry.occurredAt),
    entry,
   })):[]),
  ];
  const todayManila=getPhilippineCalendarDate();
  const cutoff=dateFilter==='today'
   ?todayManila
   :dateFilter==='last_7_days'
    ?shiftCalendarDate(todayManila,-6)
    :dateFilter==='last_30_days'
     ?shiftCalendarDate(todayManila,-29)
     :'';
  const filtered=cutoff
   ?items.filter(item=>{
    const ymd=toManilaYmd(item.occurredAt);
    return ymd!==''&&ymd>=cutoff;
   })
   :items;
  return filtered.sort((a,b)=>sortOrder==='newest'
   ?(b.timeMs-a.timeMs)||b.id.localeCompare(a.id)
   :(a.timeMs-b.timeMs)||a.id.localeCompare(b.id));
 },[displayed,extraEntries,cursor,dateFilter,sortOrder]);

 const hasAnyItems=displayed.length>0||(extraEntries?.length??0)>0;
 if(!focusedNode&&!hasAnyItems&&!error&&!loading)return null;

 return <section className="r7-work nw-activity" aria-label="Delegation history">
  <header className="nw-activity-heading">
   <div className="nw-activity-heading-main">
    <div className="nw-activity-heading-icon"><History size={22} aria-hidden="true"/></div>
    <div>
     <h3 ref={heading} tabIndex={-1}>Activity history</h3>
     <p>Who changed what, and when. {sortOrder==='newest'?'Latest changes first.':'Oldest changes first.'}</p>
    </div>
   </div>
   <div className="nw-activity-controls">
    <label className="nw-activity-filter">
     <CalendarDays size={14} aria-hidden="true"/>
     <span className="sr-only">Filter activity by date</span>
     <select aria-label="Filter activity by date" value={dateFilter} onChange={e=>setDateFilter(e.target.value as ActivityDateFilter)}>
      <option value="all">All dates</option>
      <option value="today">Today</option>
      <option value="last_7_days">Last 7 days</option>
      <option value="last_30_days">Last 30 days</option>
     </select>
    </label>
    <label className="nw-activity-filter">
     <ArrowUpDown size={14} aria-hidden="true"/>
     <span className="sr-only">Sort activity by date</span>
     <select aria-label="Sort activity by date" value={sortOrder} onChange={e=>setSortOrder(e.target.value as ActivitySortOrder)}>
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
     </select>
    </label>
    {cursor&&<button type="button" disabled={loading} onClick={()=>showPage()}><ArrowUp size={16} aria-hidden="true"/><span>Latest activity</span></button>}
   </div>
  </header>
  {error&&<p role="alert">{error}<button type="button" onClick={()=>setRetry(v=>v+1)}>Retry delegation history</button></p>}
  {loading&&<p role="status">Loading delegation history…</p>}
  {!mergedItems.length&&!error&&!loading&&(
   dateFilter!=='all'
    ?<div className="space-y-2">
      <EmptyState illustration="tasks" size="compact" title="No activity found for this date range."/>
      <div className="flex justify-center"><button type="button" onClick={()=>setDateFilter('all')}>Show all dates</button></div>
     </div>
    :focusedNode&&<EmptyState illustration="tasks" size="compact" title="No permitted work changes on this page."/>
  )}
  {mergedItems.length>0&&(
   <ol className="nw-activity-timeline">
    {mergedItems.map(item=>item.type==='event'
     ?<WorkActivityCard key={item.id} event={item.event} presentation={presentWorkEvent(item.event,focusedNode)}/>
     :<WorkActivityExtraCard key={item.id} entry={item.entry}/>)}
   </ol>
  )}
  {more&&<button type="button" className="nw-activity-older" disabled={loading||!!error} onClick={()=>{const last=events[events.length-1];if(last)showPage({time:last.occurred_at,id:last.id});}}><ArrowDown size={15} aria-hidden="true"/>Older work changes</button>}
 </section>;
}
