import type { NotificationNavigationIntent } from "./navigation";

type IntentListener = (intent: NotificationNavigationIntent) => void;

let pending: {intent:NotificationNavigationIntent;actorId?:string} | null = null;
const listeners = new Set<IntentListener>();
const storageKey=(actorId:string)=>`eflow.notification-intent.v1:${actorId}`;
const kinds=new Set(['task','subtask','leading_task','task_review','subtask_review','announcement','team_intelligence','project','proposal','collaboration','budget']);
const fields=['notificationId','kind','taskId','projectId','proposalId','entityLabel','entityId','inspectorSection','financialRecordId','financialRecordType'] as const;
const optionalFields=['taskId','projectId','proposalId','entityLabel','entityId','financialRecordId','financialRecordType'] as const;
function read(actorId:string):NotificationNavigationIntent|null {
  try{
    if(typeof window==='undefined')return null;
    const raw=window.sessionStorage.getItem(storageKey(actorId));if(!raw)return null;
    const value=JSON.parse(raw);
    if(value?.actorId!==actorId||!value.intent||typeof value.intent.notificationId!=='string'||!value.intent.notificationId||!kinds.has(value.intent.kind))return null;
    const intent:NotificationNavigationIntent={notificationId:value.intent.notificationId,kind:value.intent.kind};
    if(value.intent.inspectorSection!==undefined){if(!['work','review'].includes(value.intent.inspectorSection))return null;intent.inspectorSection=value.intent.inspectorSection;}
    for(const field of optionalFields){const part=value.intent[field];if(part!==undefined){if(typeof part!=='string')return null;intent[field]=part;}}
    return Object.freeze(intent);
  }catch{return null;}
}
function persist(actorId:string,intent:NotificationNavigationIntent|null){
  try{
    if(typeof window==='undefined')return;
    if(intent)window.sessionStorage.setItem(storageKey(actorId),JSON.stringify({actorId,intent:Object.fromEntries(fields.map(field=>[field,intent[field]]))}));
    else window.sessionStorage.removeItem(storageKey(actorId));
  }catch{/* Storage may be disabled. Keep the existing runtime navigation contract. */}
}

export function queueNotificationNavigationIntent(
  intent: NotificationNavigationIntent,
  actorId?:string,
): void {
  const owned=Object.freeze({...intent});
  pending = {intent:owned,actorId};
  if(actorId)persist(actorId,owned);
  listeners.forEach((listener) => listener(owned));
}

export function peekNotificationNavigationIntent(actorId?:string): NotificationNavigationIntent | null {
  if(pending&&(!actorId||!pending.actorId||pending.actorId===actorId))return pending.intent;
  if(!actorId)return null;
  const intent=read(actorId);if(intent)pending={intent,actorId};
  return intent;
}

export function completeNotificationNavigationIntent(notificationId: string,expected?:NotificationNavigationIntent): void {
  if(pending?.intent.notificationId!==notificationId||(expected&&pending.intent!==expected))return;
  if(pending.actorId)persist(pending.actorId,null);
  pending=null;
}

export function subscribeToNotificationNavigationIntent(
  listener: IntentListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
