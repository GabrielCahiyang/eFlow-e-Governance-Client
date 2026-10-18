import {useState} from 'react';
import {ShieldCheck,RefreshCw} from 'lucide-react';
import {Button} from '../../../components/ui/button';
import {RecordDetailPage,WorkspaceTabs} from '../../../components/ui/workspace';
import {requestNavigation} from '../../../shared/navigationGuard';
import type {AuditEvent} from '../../../services/auditService';
import {auditActionTone,humanizeAuditAction,humanizeEntityType} from '../presentation';
import {AuditCopyButton} from './AuditCopyButton';
import {AuditEventDetailContent,type AuditDetailSection} from './AuditEventDetailContent';
import '../auditDetailPage.css';

export function AuditEventDetailPage({event,entityLabel,officeLabel,checking,error,onBack,onRefresh}:{event?:AuditEvent;entityLabel:string;officeLabel:string;checking:boolean;error:string;onBack:()=>void;onRefresh:()=>void}){
 const [section,setSection]=useState<AuditDetailSection>('overview');
 const available=!checking&&!error&&!!event;
 return <RecordDetailPage title={available?humanizeAuditAction(event.action):'Event details'} subtitle={available?entityLabel:undefined} breadcrumb="Account Audit" detailLabel="Event details" backLabel="Back to Account Audit" onBack={onBack}
  status={<><span className="audit-detail__badge" data-tone={available?auditActionTone(event.action):'neutral'}>{available?humanizeEntityType(event.entityType):'Account Audit'}</span><span className="audit-detail__immutable"><ShieldCheck size={15} aria-hidden="true"/>Read-only record</span></>}
  actions={<Button variant="outline" className="min-h-11" disabled={checking} onClick={onRefresh}><RefreshCw size={16} aria-hidden="true"/>{checking?'Checking access…':'Refresh audit'}</Button>}>
  {available?<>
   <div className="audit-detail__reference"><div><span>Event reference</span><code>{event.id}</code></div><AuditCopyButton key={event.id} value={event.id} label="Copy event reference"/></div>
   <WorkspaceTabs label="Audit event sections" value={section} onValueChange={value=>void requestNavigation(()=>setSection(value as AuditDetailSection))} tabs={([
    ['overview','Overview'],['changes','Changed fields'],['technical','Technical details'],
   ] as const).map(([id,label])=>({id,label,content:<AuditEventDetailContent event={event} entityLabel={entityLabel} officeLabel={officeLabel} section={id}/>}))}/>
   <p className="audit-detail__footer"><ShieldCheck size={17} aria-hidden="true"/>This event is append-only. It cannot be edited or deleted here.</p>
  </>:checking?<div role="status" className="audit-detail__notice"><h2>Checking current access</h2><p>Verifying this event against the latest permitted audit records.</p><div className="audit-detail__skeleton" aria-hidden="true"/></div>:<div role="alert" className="audit-detail__notice"><h2>Event unavailable</h2><p>{error||'This event is no longer in the latest 500 permitted records, or your access has changed. Return to Account Audit to view the current list.'}</p></div>}
 </RecordDetailPage>;
}
