import type {WorkRequest,WorkTreeSnapshot,WorkCapabilityContext} from '../types';
import type {WorkEditorBaseline,WorkEditorFields} from '../types/editor';
import {sameWorkEditorScope,workEditorReceiptRetryAllowed} from '../selectors/editorDraft';

const prefix='eflow:nested-work-draft:v1:';
export interface WorkDraftRecord {version:1;mode:string;baseline:WorkEditorBaseline;fields:WorkEditorFields;request?:WorkRequest;requestState?:'unknown_result'|'stale_revision'|'revoked_authority';uncertain?:boolean}
const commands=['create','edit','move','order','delete','progress','submit','review','staff','contributors','root_lead'];
const text=(value:unknown,max=128):value is string=>typeof value==='string'&&value.length<=max;
const ids=(value:unknown,max=200):value is string[]=>Array.isArray(value)&&value.length<=max&&value.every(id=>text(id));
function fields(value:WorkEditorFields):WorkEditorFields {
 return {title:value.title,due:value.due,lead:value.lead,people:[...value.people],parent:value.parent,standalone:value.standalone,note:value.note,progress:value.progress,order:[...value.order]};
}
function validFields(value:WorkEditorFields):boolean {
 return !!value&&text(value.title,200)&&text(value.due,10)&&text(value.lead)&&text(value.parent)&&text(value.note,4000)
  &&ids(value.people)&&ids(value.order,10000)&&typeof value.standalone==='boolean'&&Number.isFinite(value.progress)&&value.progress>=0&&value.progress<=100;
}
const payloadKeys:Record<string,string[]>={create:['id','title','parent','lead','people','due','standalone'],edit:['id','title','due','standalone','note'],move:['id','parent'],order:['parent','order'],delete:['id'],progress:['id','progress','note'],submit:['id','note'],review:['id','approve','note'],staff:['id','lead','people'],contributors:['people'],root_lead:['lead','people']};
/** Only scalar command terms and ID arrays. No snapshots, evidence or credentials. */
function cleanRequest(value:WorkRequest):WorkRequest|undefined {
 if(!value||!text(value.id)||!commands.includes(value.command)||!Number.isSafeInteger(value.revision)||value.revision<1||!value.payload||typeof value.payload!=='object')return;
 if(value.impactFingerprint!==undefined&&!text(value.impactFingerprint,4096))return;
 const payload:Record<string,unknown>={};
 for(const [key,item] of Object.entries(value.payload)){
  if(!payloadKeys[value.command].includes(key))return;
  if(key==='people'||key==='order'){if(!ids(item,key==='order'?10000:200))return;payload[key]=Object.freeze([...item]);}
  else if(item===null||typeof item==='boolean'||typeof item==='number'&&Number.isFinite(item)||text(item,key==='note'?4000:200))payload[key]=item;
  else return;
 }
 return Object.freeze({id:value.id,command:value.command,revision:value.revision,payload:Object.freeze(payload),...(value.impactFingerprint!==undefined?{impactFingerprint:value.impactFingerprint}:{})});
}
function cleanRecord(value:WorkDraftRecord):WorkDraftRecord|undefined {
 const b=value?.baseline;
 if(value?.version!==1||!text(value.mode)||!b||!b.actorId||!text(b.actorId)||!text(b.rootId)||!text(b.projectId)||!text(b.createdId)
  ||!(b.officeId===null||text(b.officeId))||!['office','personal'].includes(b.kind)||!commands.includes(b.command)
  ||!(b.nodeId===null||text(b.nodeId))||!Number.isSafeInteger(b.revision)||b.revision<1||!validFields(b.fields)||!validFields(value.fields))return;
 const request=value.request?cleanRequest(value.request):undefined;
 if(value.request&&!request||request&&request.revision!==b.revision||value.requestState!==undefined&&!['unknown_result','stale_revision','revoked_authority'].includes(value.requestState)||value.uncertain!==undefined&&typeof value.uncertain!=='boolean')return;
 return {version:1,mode:value.mode,baseline:{actorId:b.actorId,rootId:b.rootId,projectId:b.projectId,officeId:b.officeId,kind:b.kind,revision:b.revision,command:b.command,nodeId:b.nodeId,createdId:b.createdId,fields:fields(b.fields)},fields:fields(value.fields),...(request?{request,requestState:value.requestState||'unknown_result',uncertain:value.uncertain??true}:{})};
}
export function workDraftIdentity(b:WorkEditorBaseline,mode:string=b.command):string {
 return [b.actorId,b.projectId,b.rootId,b.nodeId||(b.command==='create'||b.command==='order'?b.fields.parent||'root':'root'),mode].map(value=>encodeURIComponent(value||'')).join(':');
}
export const workDraftKey=(record:WorkDraftRecord)=>prefix+workDraftIdentity(record.baseline,record.mode)+':'+record.baseline.revision;
function storage():Storage|undefined {try{return window.sessionStorage;}catch{return;}}
export function writeWorkDraft(value:WorkDraftRecord):boolean {
 try{const record=cleanRecord(value),target=storage();if(!record||!target)return false;target.setItem(workDraftKey(record),JSON.stringify(record));return true;}catch{return false;}
}
export function removeWorkDraft(record:WorkDraftRecord):void {try{storage()?.removeItem(workDraftKey(record));}catch{/* In-memory draft remains usable when storage is unavailable. */}}
export function isolateWorkDraftActor(actorId:string|null):void {
 try{const target=storage();if(!target)return;for(const key of Object.keys(target))if(key.startsWith(prefix)&&(!actorId||!key.startsWith(prefix+encodeURIComponent(actorId)+':')))target.removeItem(key);}catch{/* Recovery never grants access. */}
}
export function readWorkDrafts(data:WorkTreeSnapshot,context:WorkCapabilityContext):WorkDraftRecord[] {
 if(!workEditorReceiptRetryAllowed(data,{...context,readOnly:false}))return [];
 try{const target=storage();if(!target)return [];const result:WorkDraftRecord[]=[];
  for(const key of Object.keys(target)){if(!key.startsWith(prefix))continue;
   try{const record=cleanRecord(JSON.parse(target.getItem(key)||'null'));if(record&&key===workDraftKey(record)&&sameWorkEditorScope(record.baseline,context))result.push(record);}catch{/* Ignore corrupt or foreign records. */}
  }
  return result.sort((a,b)=>b.baseline.revision-a.baseline.revision);
 }catch{return [];}
}
