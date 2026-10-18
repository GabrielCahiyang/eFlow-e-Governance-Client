import { EmptyState } from '../../../components/ui/EmptyState';
import {Building2,CalendarClock,Database,MessageSquareText,UserRound} from 'lucide-react';
import type {ReactNode} from 'react';
import {buildDiff,type AuditEvent,type DiffRow} from '../../../services/auditService';
import {humanizeAuditField,orderAuditDiff,presentAuditValue,redactAuditDisplay} from '../presentation';
import {AuditCopyButton} from './AuditCopyButton';
export type AuditDetailSection='overview'|'changes'|'technical';

export function auditEventTime(timestamp:number){return Number.isFinite(timestamp)?new Date(timestamp).toLocaleString('en-PH',{timeZone:'Asia/Manila',dateStyle:'medium',timeStyle:'short'}):'Not recorded';}

/** Every value follows the existing diff/redaction pipeline, independent of its surface. */
export function AuditEventDetailContent({event,entityLabel,officeLabel,section}:{event:AuditEvent;entityLabel:string;officeLabel:string;section:AuditDetailSection}){
 if(section==='overview')return <div className="audit-detail__overview">
  <div className="audit-detail__summary">
   <SummaryCard icon={<UserRound size={18}/>} label="Responsible actor" value={event.actorName||'Not recorded'}/>
   <SummaryCard icon={<CalendarClock size={18}/>} label="Recorded at" value={auditEventTime(event.createdAt)} detail="Philippine time"/>
   <SummaryCard icon={<Database size={18}/>} label="Affected record" value={entityLabel} detail={event.entityId}/>
   <SummaryCard icon={<Building2 size={18}/>} label="Office" value={officeLabel}/>
  </div>
  <section className="audit-detail__card audit-detail__note"><h2><MessageSquareText size={18} aria-hidden="true"/>Recorded note</h2><p>{event.reason||'No note was recorded for this event.'}</p></section>
 </div>;
 if(section==='changes'){
  const changes=orderAuditDiff(buildDiff(event.beforeData,event.afterData));
  return <section className="audit-detail__card"><div className="audit-detail__section-heading"><div><h2>Recorded changes</h2><p>Before and after values captured by this event.</p></div><span>{changes.length} fields</span></div>
   {changes.length?<div className="audit-detail__changes">{changes.map(change=><ChangeRow key={change.key} change={change}/>)}</div>:<EmptyState illustration="empty" size="compact" title="No field-level changes were recorded."/>}
  </section>;
 }
 const metadata=Object.entries(event.metadata||{});
 return <section className="audit-detail__card"><div className="audit-detail__section-heading"><div><h2>Technical details</h2><p>Original metadata, with sensitive values hidden.</p></div></div>
  {metadata.length?<dl className="audit-detail__metadata">{metadata.map(([key,value])=><TechnicalValue key={key} field={key} value={value}/>)}</dl>:<EmptyState illustration="files" size="compact" title="No additional metadata was recorded."/>}
 </section>;
}
function SummaryCard({icon,label,value,detail}:{icon:ReactNode;label:string;value:string;detail?:string}){
 return <div className="audit-detail__summary-card"><div className="audit-detail__label"><span aria-hidden="true">{icon}</span>{label}</div><p>{value}</p>{detail&&<small>{detail}</small>}</div>;
}
function ChangeRow({change}:{change:DiffRow}){
 const label=humanizeAuditField(change.key);
 return <article className="audit-detail__change"><div className="audit-detail__field-heading"><h3>{label}</h3>{!change.changed&&<span>Unchanged</span>}</div><div className="audit-detail__pair">
  <AuditValue label="Before" field={change.key} value={change.before}/><AuditValue label="After" field={change.key} value={change.after} emphasized={change.changed}/>
 </div></article>;
}
function AuditValue({label,field,value,emphasized}:{label:string;field:string;value:unknown;emphasized?:boolean}){
 const presented=presentAuditValue(field,value);
 const redacted=redactAuditDisplay(field,value);
 const technical=presented.technical||(Array.isArray(redacted)&&redacted.some(item=>item&&typeof item==='object')?JSON.stringify(redacted,null,2):undefined);
 return <div className="audit-detail__value" data-emphasized={emphasized||undefined}><h4>{label}</h4><p data-empty={presented.empty||undefined}>{presented.display}</p>{technical&&<><pre>{technical}</pre><AuditCopyButton value={technical} label={`Copy ${label.toLowerCase()} ${humanizeAuditField(field).toLowerCase()}`}/></>}</div>;
}
function TechnicalValue({field,value}:{field:string;value:unknown}){
 const redacted=redactAuditDisplay(field,value),presented=presentAuditValue(field,redacted);
 const text=redacted&&typeof redacted==='object'?JSON.stringify(redacted,null,2):presented.technical||presented.display;
 return <div><dt>{humanizeAuditField(field)}</dt><dd><pre>{text}</pre></dd></div>;
}
