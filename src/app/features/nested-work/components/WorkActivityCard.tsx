import {ArrowRight,ArrowRightLeft,CalendarDays,CheckCircle2,FilePenLine,ListOrdered,ListPlus,MessageSquareText,Trash2,Users} from 'lucide-react';
import type {WorkEvent} from '../services/workTreeService';
import type {WorkEventPresentation} from '../selectors/workEventPresentation';
import {DeadlineBadge} from '../../../components/ui/DeadlineBadge';
const icons:Record<string,typeof Users>={create:ListPlus,staff:Users,root_lead:Users,contributors:Users,edit:FilePenLine,move:ArrowRightLeft,order:ListOrdered,delete:Trash2,progress:MessageSquareText,submit:CheckCircle2,review:CheckCircle2};
function valueLabel(label:string,value:string){
 if(label==='Deadline'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return new Date(value+'T00:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
 return value;
}
function Change({entry,at}:{entry:string;at:number}){
 const colon=entry.indexOf(': '),label=colon<0?'':entry.slice(0,colon),value=colon<0?entry:entry.slice(colon+2),arrow=value.indexOf(' → ');
 if(arrow>=0){
  const before=value.slice(0,arrow),after=value.slice(arrow+3);
  if(before===after)return null;
  return <div className="nw-activity-change"><dt>{label||'Changed'}</dt><dd><span className="nw-activity-before">{valueLabel(label,before)}</span><ArrowRight size={14} aria-hidden="true"/><span className="sr-only">changed to</span>{label==='Deadline'&&/^\d{4}-\d{2}-\d{2}$/.test(after)?<DeadlineBadge value={after} now={at} history/>:<span className="nw-activity-after">{valueLabel(label,after)}</span>}</dd></div>;
 }
 return <div className="nw-activity-change"><dt>{label||'Details'}</dt><dd>{label==='Deadline'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?<DeadlineBadge value={value} now={at} history/>:valueLabel(label,value)}</dd></div>;
}
export function WorkActivityCard({event,presentation}:{event:WorkEvent;presentation:WorkEventPresentation}){
 const Icon=icons[event.command]||MessageSquareText;
 const initials=event.actor_name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
 return <li className="nw-activity-entry"><span className="nw-activity-marker" data-command={event.command}><Icon size={18} aria-hidden="true"/></span><article className="nw-activity-card" aria-label={presentation.title}>
  <header><span className="nw-activity-avatar" aria-hidden="true">{initials}</span><div className="nw-activity-person"><strong>{event.actor_name}</strong><span>{presentation.title}</span></div><time dateTime={event.occurred_at}><CalendarDays size={13} aria-hidden="true"/>{new Date(event.occurred_at).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})}</time></header>
  <dl className="nw-activity-changes">{presentation.entries.length?presentation.entries.map((entry,index)=><Change key={index} entry={entry} at={Date.parse(event.occurred_at)}/>):<div className="nw-activity-change"><dt>Details</dt><dd>{presentation.detail}</dd></div>}</dl>
 </article></li>;
}
