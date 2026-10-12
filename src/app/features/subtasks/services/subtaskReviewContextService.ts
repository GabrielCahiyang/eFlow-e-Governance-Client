import {supabase} from '../../../../lib/supabase';
import {readAllRows} from '../../../shared/readAllRows';
import {rowToSubtask} from '../../../services/subtaskService';
import {buildSubtaskDisplayMetadata,deduplicateWorkPersonIds,mergeWorkDisplayMetadata,type WorkPerson} from '../../nested-work';
import type {SubtaskReviewItem} from '../types';

/** Keep identifier URLs and result pages bounded for queue hydration as well. */
export async function readSubtaskReviewRows(table:string,columns:'*'|'id,title,project_title,linked_project_id'|'id,title',key:string,ids:string[]) {
 try {
  const data:Record<string,unknown>[]=[];
  const unique=deduplicateWorkPersonIds(ids);
  for(let offset=0;offset<unique.length;offset+=100){
   const selected=unique.slice(offset,offset+100);
   data.push(...await readAllRows<Record<string,unknown>>((from,to)=>{
    const source=supabase.from(table);
    const query=columns==='*'?source.select('*',{count:'exact'}):columns==='id,title'?source.select('id,title',{count:'exact'}):source.select('id,title,project_title,linked_project_id',{count:'exact'});
    return query.in(key,selected).order('id',{ascending:true}).range(from,to);
   }));
  }
  return {data,error:null};
 } catch(caught){return {data:[],error:{message:caught instanceof Error?caught.message:'Review context unavailable'}};}
}

/** Supplement only current queue records. RLS decides which root/ancestor/person
 * records are readable. No parent-by-parent lookup or reviewer reconstruction.
 */
export async function addSubtaskReviewDisplayContext(items:SubtaskReviewItem[],tasks:readonly Record<string,unknown>[]):Promise<SubtaskReviewItem[]> {
 const rootIds=deduplicateWorkPersonIds(items.map(item=>item.subtask.taskId));
 const {data:rows,error}=await readSubtaskReviewRows('subtasks','*','task_id',rootIds);
 if(error)throw new Error(error.message);
 const records=rows.filter(row=>rootIds.includes(row.task_id as string)).map(rowToSubtask);
 const ids=deduplicateWorkPersonIds(items.flatMap(({subtask})=>[...(subtask.leadId?[subtask.leadId]:[]),...subtask.assignedToIds]));
 const people:WorkPerson[]=[];
 for(let offset=0;offset<ids.length;offset+=100){
  const selected=ids.slice(offset,offset+100);
  const rows=await readAllRows<{id:string;full_name:string|null}>((from,to)=>supabase.from('profiles').select('id,full_name',{count:'exact'}).in('id',selected).order('id',{ascending:true}).range(from,to));
  for(const row of rows)if(selected.includes(row.id)&&row.full_name)people.push({id:row.id,name:row.full_name});
 }
 const contexts=new Map(rootIds.flatMap(rootId=>[...buildSubtaskDisplayMetadata(records,{rootId,rootTitle:tasks.find(task=>task.id===rootId)?.title as string|undefined,people})]));
 return items.flatMap(item=>{
  const context=contexts.get(item.subtask.id);
  const verified=context?.rootId===item.subtask.taskId?context:undefined;
  if(!verified)return [];
  return [{...item,subtask:mergeWorkDisplayMetadata(item.subtask,verified),submission:{...item.submission,workContext:verified}}];
 });
}
