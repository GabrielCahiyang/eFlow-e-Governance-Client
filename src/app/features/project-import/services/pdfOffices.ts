import { readAiText, requestAiChat, type AiQueueUpdate } from '../../ai';
import type { ProjectImportDraft, ProposedOffice } from '../types';

const normalized=(text:string)=>text.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const generic=/^(?:relevant|other|concerned|various|all|participating)\b|\b(?:offices|departments|stakeholders|partners)\s*$/i;
const responsibility=/responsib|implement|partner|collaborat|participat|coordinat|proponent|\bin[ -]charge|\blead(?:s|ing)?\b(?!\s+(?:consult|fund|financ))/i;
export const officeAliases=(name:string)=>[normalized(name),...(name.match(/\(([A-Z][A-Z0-9 .-]{1,15})\)/g)||[]).map(value=>normalized(value.slice(1,-1))),normalized(name.replace(/\([^)]*\)/g,'').split(/\s+/).filter(word=>!['and','of','the','for'].includes(word.toLowerCase())).map(word=>word[0]).join(''))];
export interface OfficeExtraction { offices:ProposedOffice[]; taskOffices:Record<string,string>; clarification:string[] }

export function parsePdfOffices(raw:string,source:string,taskKeys:string[],taskTitles:Record<string,string>={}):OfficeExtraction {
 const data=JSON.parse(raw.replace(/<think>[\s\S]*?<\/think>/gi,'').match(/\{[\s\S]*\}/)?.[0]||'{}');
 if(!Array.isArray(data.offices)||data.offices.length>30)throw new Error('The AI did not return a valid Office list. Retry office extraction.');
 const offices:ProposedOffice[]=[],clarification:string[]=[],keys=new Map<string,string>();
 for(const item of data.offices){
  if(typeof item.name!=='string'||typeof item.evidence!=='string'||item.name.length>200||item.evidence.length>2000)throw new Error('Invalid Office source details.');
  if(item.kind==='funding')continue;
  const name=item.name.trim(),evidence=item.evidence.trim();
  if(!name||!evidence||!normalized(source).includes(normalized(evidence))||!normalized(evidence).includes(normalized(name)))throw new Error('An Office could not be verified against the PDF. Retry extraction.');
  const responsibilityEvidence=evidence.replace(/\b(?:funding|financial|budget)\s+partners?\b/gi,'');
  if(generic.test(name)||item.kind!=='responsible'||!responsibility.test(responsibilityEvidence)){clarification.push(name);continue;}
  let office=offices.find(o=>officeAliases(o.name).some(alias=>alias.length>1&&officeAliases(name).includes(alias)));
  if(!office){office={key:`office-${offices.length+1}`,name,evidence,officeId:'',confirmed:false};offices.push(office);}
  keys.set(item.key,office.key);
 }
 const taskOffices:Record<string,string>={};
 for(const [key,value] of Object.entries(data.taskOffices||{}))if(taskKeys.includes(key)&&typeof value==='string'&&keys.has(value)){
  const evidence=data.taskEvidence?.[key];
  if(typeof evidence==='string'&&normalized(source).includes(normalized(evidence))&&(!taskTitles[key]||normalized(evidence).includes(normalized(taskTitles[key])))&&offices.some(office=>office.key===keys.get(value)&&officeAliases(office.name).some(alias=>alias.length>1&&normalized(evidence).includes(alias))))taskOffices[key]=keys.get(value)!;
 }
 return {offices,taskOffices,clarification:[...new Set(clarification)]};
}

/** Overlap preserves sentences near a boundary; no document tail is discarded. */
export function officeSourceChunks(source:string):string[] {
 const chunks:string[]=[];let start=0;
 while(start<source.length){
  let end=Math.min(start+3200,source.length);
  if(end<source.length){const boundary=source.lastIndexOf(' ',end);if(boundary>start+2400)end=boundary;}
  chunks.push(source.slice(start,end));
  if(end===source.length)break;
  start=Math.max(start+1,end-500);
 }
 return chunks.length?chunks:[''];
}

export function mergeOfficeExtractions(parts:OfficeExtraction[]):OfficeExtraction {
 const offices:ProposedOffice[]=[],taskOffices:Record<string,string>={},clarification=new Set<string>(),ambiguous=new Set<string>();
 for(const part of parts){
  const keys=new Map<string,string>();
  for(const item of part.offices){
   let office=offices.find(value=>officeAliases(value.name).some(alias=>alias.length>1&&officeAliases(item.name).includes(alias)));
   if(!office){office={...item,key:`office-${offices.length+1}`};offices.push(office);}
   keys.set(item.key,office.key);
  }
  for(const [task,key] of Object.entries(part.taskOffices)){
   const merged=keys.get(key);if(!merged||ambiguous.has(task))continue;
   if(taskOffices[task]&&taskOffices[task]!==merged){delete taskOffices[task];ambiguous.add(task);clarification.add(`Check responsible office for ${task}`);}
   else taskOffices[task]=merged;
  }
  part.clarification.forEach(value=>clarification.add(value));
 }
 if(offices.length>30)throw new Error('Too many Office names were found. Review a shorter project document.');
 return {offices,taskOffices,clarification:[...clarification]};
}

export async function extractPdfOffices(source:string,draft:ProjectImportDraft,requestId:string,onQueueUpdate:(update:AiQueueUpdate)=>void) {
 const tasks=draft.groups.flatMap(group=>group.tasks).map(task=>({key:task.key,title:task.title}));
 // Bound both document and task context; Qwen uses a finite context window.
 const documents=officeSourceChunks(source),taskBatches:typeof tasks[]=[[]];
 for(const task of tasks){let batch=taskBatches[taskBatches.length-1];if(batch.length&&JSON.stringify([...batch,task]).length>1800){batch=[];taskBatches.push(batch);}batch.push(task);}
 const parts:OfficeExtraction[]=[];
 for(let documentIndex=0;documentIndex<documents.length;documentIndex++)for(let taskIndex=0;taskIndex<taskBatches.length;taskIndex++){
  const batch=taskBatches[taskIndex];
  const response=await requestAiChat({model:"qwen3.5:4b",messages:[{role:"user",content:"Extract source-grounded offices."}],
   pdf_office_extraction:{schemaVersion:1,document:documents[documentIndex],tasks:batch}},
   {requestId:`${requestId}:office-schema-v3:${documentIndex}:${taskIndex}`,onQueueUpdate:update=>onQueueUpdate({...update,progress:{...update.progress,stage:"office_excerpt",message:`Checking office evidence · excerpt ${documentIndex+1} of ${documents.length}`,current:documentIndex+1,total:documents.length}})});
  parts.push(parsePdfOffices(readAiText(response),source,batch.map(task=>task.key),Object.fromEntries(batch.map(task=>[task.key,task.title]))));
 }
 return mergeOfficeExtractions(parts);
}
