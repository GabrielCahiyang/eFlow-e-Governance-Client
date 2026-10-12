import type {WorkNodeDisplayMetadata, WorkPerson} from '../types';
import {buildSubtaskDisplayMetadata, type SubtaskDisplayRecord} from './workDisplayContext';
import {resolveWorkPersonName} from './people';

/** Only already authorized roots, records and directories belong here. Cached
 * Task names and current display context are display facts, never eligibility.
 */
export interface WorkDisplayRootRecord {
 id:string;title:string;assigneeId?:string;assigneeName?:string;
 teamMemberIds?:readonly string[];teamMemberNames?:readonly string[];
}
export function buildWorkRecordDisplayMetadata(
 roots:readonly WorkDisplayRootRecord[],
 records:readonly (SubtaskDisplayRecord & {workContext?:WorkNodeDisplayMetadata})[],
 people:readonly WorkPerson[] = [],
):ReadonlyMap<string,WorkNodeDisplayMetadata> {
 const result=new Map<string,WorkNodeDisplayMetadata>();
 for(const root of roots){
  const scoped=records.filter(record=>record.taskId===root.id);
  const directory=new Map<string,WorkPerson>();
  const remember=(id:string|undefined,name:string|undefined)=>{
   if(id&&name&&name!==resolveWorkPersonName([],id))directory.set(id,{id,name});
  };
  remember(root.assigneeId,root.assigneeName);
  root.teamMemberIds?.forEach((id,index)=>remember(id,root.teamMemberNames?.[index]));
  for(const record of scoped){
   const context=record.workContext;
   if(context?.rootId!==root.id||context.nodeId!==record.id)continue;
   remember(context.leadId??undefined,context.leadName??undefined);
   context.contributors.forEach(person=>remember(person.id,person.name));
  }
  people.forEach(person=>remember(person.id,person.name));
  for(const [id,context] of buildSubtaskDisplayMetadata(scoped,{rootId:root.id,rootTitle:root.title,people:[...directory.values()]}))result.set(id,context);
 }
 return result;
}
