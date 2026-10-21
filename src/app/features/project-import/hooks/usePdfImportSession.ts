import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { readProjectDocument } from '../services/documentService';
import { generatePdfProjectDraft } from '../services/pdfProjectDraft';
import { extractPdfOffices,officeAliases } from '../services/pdfOffices';
import { prepareImportAssignment } from '../../staffing';
import { reviewedImportPayload } from '../selectors/draftValidation';
import { cacheImportFile,readImportFile,clearImportFile,pendingPdfImport,checkpointPdfImport,touchPdfImport,publishPdfImport,type PdfImportSession,type PdfSessionState } from '../services/pdfImportSession';
import type { ProjectImportResult } from '../types';
import type { AiQueueUpdate } from '../../ai';

export function usePdfImportSession(projectId:string,onImported:(result:ProjectImportResult)=>void){
 const [session,setSession]=useState<PdfImportSession|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[result,setResult]=useState<ProjectImportResult|null>(null);
 const runner=useRef(crypto.randomUUID()),current=useRef<PdfImportSession|null>(null),inFlight=useRef(false),alive=useRef(true);
 const show=(next:PdfImportSession|null)=>{current.current=next;if(alive.current)setSession(next);};
 const save=async(state:PdfSessionState)=>{if(!current.current)throw new Error('Import session is missing.');const next=await checkpointPdfImport(current.current,runner.current,state);show(next);return next;};
 const event=async(stage:PdfSessionState['stage'],text:string,patch:Partial<PdfSessionState>={})=>{
  const state=current.current!.state;setMessage(text);return save({...state,...patch,stage,events:[...state.events.filter(value=>value!==text),text].slice(-140)});
 };
 useEffect(()=>{alive.current=true;let active=true;setLoading(true);void pendingPdfImport(projectId).then(value=>{if(active)show(value!);}).catch(reason=>{if(active)setError((reason as Error).message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;alive.current=false;};},[projectId]);
 const queue=(update:AiQueueUpdate)=>{if(alive.current)setMessage(update.status==='queued'?`Waiting for AI · ${update.jobsAhead} ahead`:update.progress?.message||'AI is preparing this step…');};
 const run=async()=>{
  if(inFlight.current||!current.current)return;
  inFlight.current=true;setBusy(true);setError('');
  let heartbeat:ReturnType<typeof setInterval>|undefined;
  try{
   await save(current.current.state); // Claim/check the lease before doing AI work.
   heartbeat=setInterval(()=>{if(current.current&&!current.current.result)void touchPdfImport(current.current.id,runner.current).catch(reason=>{if(alive.current&&inFlight.current&&!current.current?.result)setError((reason as Error).message);});},25000);
   if(current.current.result){setResult(current.current.result);await clearImportFile(current.current.id).catch(()=>{});onImported(current.current.result);return;}
   if(!current.current.state.sourceText){
    await event('reading','Reading your PDF');
    const file=await readImportFile(current.current.id);if(!file)throw new Error('Choose this PDF again to restore its local source file. Your saved progress is kept.');
    const sourceText=await readProjectDocument(file);await event('preparing','Checking the PDF’s work table and budget totals',{sourceText});
   }
   if(!current.current.state.draft){
    const state=current.current.state;
    let draft=await generatePdfProjectDraft(projectId,state.sourceText!,state.sourceName,state.anchor,queue,`${current.current.id}:decompose:${current.current.revision}`);
    if(!state.addOffices)draft={...draft,offices:[],groups:draft.groups.map(group=>({...group,tasks:group.tasks.map(task=>({...task,officeKey:''}))}))};
    await event('offices',`Found ${draft.groups.length} groups and ${draft.groups.flatMap(group=>group.tasks).length} tasks`,{draft});
   }
   if(current.current.state.addOffices&&!current.current.state.extraction){
    await event('offices','Checking which offices are responsible for the work');
    const state=current.current.state,extraction=await extractPdfOffices(state.sourceText!,state.draft!,`${current.current.id}:offices:${current.current.revision}`,queue);
    const {data:project,error:projectError}=await supabase.from('projects').select('org_id').eq('id',projectId).single();if(projectError)throw new Error(projectError.message);
    const {data:office,error:officeError}=await supabase.from('organizations').select('name,slug').eq('id',project!.org_id).single();if(officeError)throw new Error(officeError.message);
    const normalized=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
    const aliases=[office!.name,office!.slug,office!.name.split(/\s+/).map((word:string)=>word[0]).join('')].map(normalized);
    const offices=extraction.offices.map(item=>({...item,officeId:officeAliases(item.name).some(alias=>aliases.includes(normalized(alias)))?project!.org_id:''}));
    const draft={...state.draft!,offices,groups:state.draft!.groups.map(group=>({...group,tasks:group.tasks.map(task=>({...task,officeKey:extraction.taskOffices[task.key]||''}))}))};
    await event('review_offices','Check the office names before continuing',{extraction:{...extraction,offices},draft});
   }
   if(current.current.state.addOffices&&!current.current.state.officesReviewed)return;
   const tasks=current.current.state.draft!.groups.flatMap(group=>group.tasks);
   for(let index=current.current.state.staffingIndex||0;index<tasks.length;index++){
    const task=tasks[index],state=current.current.state,office=state.draft!.offices.find(item=>item.key===task.officeKey);
    const external=office&&!office.officeId;
    if(state.autoAssign&&!external){
     await event('staffing',`Choosing people for task ${index+1} of ${tasks.length} · ${task.title}`);
     const chosen=await prepareImportAssignment(projectId,task,state.assignments.map(item=>({lead:item.lead,hours:item.hours})),`${current.current.id}:staff:${index}:${current.current.revision}`,queue);
     await event('staffing',chosen?`People selected for ${task.title}`:`${task.title} needs people`,{staffingIndex:index+1,assignments:chosen?[...state.assignments,{key:task.key,...chosen,hours:task.estimatedHours}]:state.assignments});
    }else await event('staffing',external?`${task.title} · waiting for office invitations`:`${task.title} · assign people later`,{staffingIndex:index+1});
   }
   if(!current.current.state.review)await event('ready','Checking the final schedule, budgets and assignments',{review:reviewedImportPayload(current.current.state.draft!,current.current.state.sourceName,false)});
   await event('saving','Saving your project table');
   const saved=await publishPdfImport(current.current,runner.current);
   if(heartbeat)clearInterval(heartbeat);
   show({...current.current,result:saved});setResult(saved);setError('');setMessage('Your project table is ready');
   await clearImportFile(current.current.id).catch(()=>{});
   // The mutation is committed; secondary UI refresh must never turn it into a retry.
   try{onImported(saved);}catch{setError('Imported successfully. Refresh the project table to see the saved work.');}
  }catch(reason){if(alive.current)setError((reason as Error).message||'Could not finish this import. Resume to retry the saved stage.');}
  finally{if(heartbeat)clearInterval(heartbeat);if(current.current&&!current.current.result)await touchPdfImport(current.current.id,runner.current,true).catch(()=>{});inFlight.current=false;if(alive.current)setBusy(false);}
 };
 const upload=async(file:File,anchor:string,addOffices:boolean,autoAssign:boolean)=>{
  if(inFlight.current)return;
  if(!/\.pdf$/i.test(file.name)||file.size>20*1024*1024){setError('Choose a PDF up to 20 MB.');return;}
  if(current.current){await cacheImportFile(current.current.id,file);void run();return;}
  const id=crypto.randomUUID();
  try{
   setBusy(true);inFlight.current=true;await cacheImportFile(id,file);
   show(await checkpointPdfImport({id,project_id:projectId,revision:0,state:{} as PdfSessionState,result:null,runner:null,lease_until:null},runner.current,{stage:'reading',sourceName:file.name,anchor,addOffices,autoAssign,assignments:[],events:[]}));
  }catch(reason){setError((reason as Error).message);return;}finally{inFlight.current=false;setBusy(false);}
  void run();
 };
 const confirmOffices=async(offices:NonNullable<PdfSessionState['draft']>['offices'])=>{
  const state=current.current!.state,keys=new Set(offices.map(office=>office.key));
  try{await save({...state,officesReviewed:true,draft:{...state.draft!,offices:offices.map(office=>({...office,confirmed:true})),groups:state.draft!.groups.map(group=>({...group,tasks:group.tasks.map(task=>({...task,officeKey:keys.has(task.officeKey)?task.officeKey:''}))}))}});void run();}catch(reason){setError((reason as Error).message);}
 };
 const discard=async()=>{if(inFlight.current||!current.current)return;await save({...current.current.state,stage:'discarded',sourceText:undefined,draft:undefined,review:undefined});await clearImportFile(current.current.id).catch(()=>{});current.current=null;setSession(null);setError('');};
 return {session,busy,loading,error,message,result,upload,resume:run,confirmOffices,discard};
}
