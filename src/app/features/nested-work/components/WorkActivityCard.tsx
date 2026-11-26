import type {ReactNode} from 'react';
import {AlertTriangle,ArrowRight,ArrowRightLeft,CalendarDays,CheckCircle2,FileCheck2,FilePenLine,ListOrdered,ListPlus,MessageSquareText,MessageSquareWarning,Trash2,Users} from 'lucide-react';
import type {WorkEvent} from '../services/workTreeService';
import type {WorkEventPresentation} from '../selectors/workEventPresentation';
import {DeadlineBadge} from '../../../components/ui/DeadlineBadge';
import {formatManilaDate,formatManilaDateTime} from '../../../shared/calendarDisplay';

const icons:Record<string,typeof Users>={
 create:ListPlus,
 staff:Users,
 root_lead:Users,
 contributors:Users,
 edit:FilePenLine,
 move:ArrowRightLeft,
 order:ListOrdered,
 delete:Trash2,
 progress:MessageSquareText,
 submit:CheckCircle2,
 review:CheckCircle2,
};

export type WorkActivityExtraKind='progress_update'|'blocker'|'completion'|'submission';

export interface WorkActivityAttachment {
 id?:string;
 fileName:string;
 filePath:string;
}

export interface WorkActivityExtraEntry {
 id:string;
 kind:WorkActivityExtraKind;
 actorName:string;
 title:string;
 occurredAt:string|number;
 badge?:string;
 badgeTone?:'info'|'warning'|'success'|'danger';
 note?:string;
 blockerCategory?:string;
 blocker?:string;
 nextStep?:string;
 reviewerLine?:string;
 decisionAt?:string|number;
 decisionFeedback?:string;
 attachments?:WorkActivityAttachment[];
 renderAttachment?:(attachment:WorkActivityAttachment)=>ReactNode;
}

const extraIcons:Record<WorkActivityExtraKind,typeof Users>={
 progress_update:MessageSquareText,
 blocker:AlertTriangle,
 completion:CheckCircle2,
 submission:FileCheck2,
};

function actorInitials(name:string){
 return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
}

function valueLabel(label:string,value:string){
 if((label==='Deadline'||label==='Start date')&&/^\d{4}-\d{2}-\d{2}$/.test(value))return formatManilaDate(value,value);
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
 const initials=actorInitials(event.actor_name);
 return <li className="nw-activity-entry"><span className="nw-activity-marker" data-command={event.command}><Icon size={18} aria-hidden="true"/></span><article className="nw-activity-card" aria-label={presentation.title}>
  <header><span className="nw-activity-avatar" aria-hidden="true">{initials}</span><div className="nw-activity-person"><strong>{event.actor_name}</strong><span>{presentation.title}</span></div><time dateTime={event.occurred_at}><CalendarDays size={13} aria-hidden="true"/>{formatManilaDateTime(event.occurred_at,'—')}</time></header>
  <dl className="nw-activity-changes">{presentation.entries.length?presentation.entries.map((entry,index)=><Change key={index} entry={entry} at={Date.parse(event.occurred_at)}/>):<div className="nw-activity-change"><dt>Details</dt><dd>{presentation.detail}</dd></div>}</dl>
 </article></li>;
}

function isoDateTimeAttr(value:string|number):string|undefined{
 if(typeof value==='number'){
  return Number.isFinite(value)?new Date(value).toISOString():undefined;
 }
 return value||undefined;
}

export function WorkActivityExtraCard({entry}:{entry:WorkActivityExtraEntry}){
 const Icon=extraIcons[entry.kind]||MessageSquareText;
 const initials=actorInitials(entry.actorName);
 const hasBlocker=Boolean(entry.blocker||(entry.blockerCategory&&entry.blockerCategory!=='None'));
 const hasBody=Boolean(entry.note||hasBlocker||entry.nextStep||entry.attachments?.length||entry.reviewerLine||entry.decisionAt||entry.decisionFeedback);
 return <li className="nw-activity-entry">
  <span className="nw-activity-marker" data-command={entry.kind}><Icon size={18} aria-hidden="true"/></span>
  <article className="nw-activity-card" aria-label={entry.title}>
   <header>
    <span className="nw-activity-avatar" data-tone={entry.badgeTone||'info'} aria-hidden="true">{initials}</span>
    <div className="nw-activity-person">
     <div className="nw-activity-person-row">
      <strong>{entry.actorName}</strong>
      {entry.badge&&<span className="nw-activity-pill" data-tone={entry.badgeTone||'info'}>{entry.badge}</span>}
     </div>
     <span>{entry.title}</span>
    </div>
    <time dateTime={isoDateTimeAttr(entry.occurredAt)}><CalendarDays size={13} aria-hidden="true"/>{formatManilaDateTime(entry.occurredAt,'—')}</time>
   </header>
   {hasBody&&(
    <div className="nw-activity-update-body">
     {entry.note&&<p className="nw-activity-note">{entry.note}</p>}
     {hasBlocker&&(
      <div className="nw-activity-callout nw-activity-callout--warn">
       <AlertTriangle size={14} aria-hidden="true"/>
       <span>
        {entry.blockerCategory&&entry.blockerCategory!=='None'?<strong>{entry.blockerCategory}</strong>:<strong>Blocker</strong>}
        {entry.blocker?` · ${entry.blocker}`:''}
       </span>
      </div>
     )}
     {entry.nextStep&&(
      <div className="nw-activity-next-step">
       <ArrowRight size={14} aria-hidden="true"/>
       <span><strong>Next:</strong> {entry.nextStep}</span>
      </div>
     )}
     {entry.attachments&&entry.attachments.length>0&&entry.renderAttachment&&(
      <div className="nw-activity-attachments">
       {entry.attachments.map(att=><div key={att.id||att.filePath}>{entry.renderAttachment!(att)}</div>)}
      </div>
     )}
     {entry.reviewerLine&&<p className="nw-activity-meta-line">{entry.reviewerLine}</p>}
     {entry.decisionAt&&<p className="nw-activity-meta-line">Decision: {formatManilaDateTime(entry.decisionAt,'—')}</p>}
     {entry.decisionFeedback&&(
      <div className="nw-activity-callout nw-activity-callout--danger">
       <MessageSquareWarning size={14} aria-hidden="true"/>
       <span>{entry.decisionFeedback}</span>
      </div>
     )}
    </div>
   )}
  </article>
 </li>;
}
