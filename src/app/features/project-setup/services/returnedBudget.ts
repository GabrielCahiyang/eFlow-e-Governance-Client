import {supabase} from '../../../../lib/supabase';

export interface ReturnedBudget {
 /** Unused task budget returned to the project when work was completed. */
 task: number;
 /** Per-subtask cap that was released when that subtask was completed. */
 subtasks: Map<string,number>;
 /** Latest return, for display in the budget dialog. */
 lastReturnedAt?: string;
}

const EMPTY:ReturnedBudget={task:0,subtasks:new Map()};
const cents=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>0?Math.round(n*100):0;};

/**
 * Completing work returns its unused allocation to the project budget, which
 * shrinks the live allocation. The server records each return in the task's
 * activity log; this reads it back so the original budget stays visible.
 */
export async function fetchReturnedBudget(taskId:string):Promise<ReturnedBudget>{
 const {data,error}=await supabase.from('task_activities').select('metadata,created_at')
  .eq('task_id',taskId).eq('type','budget_unused_returned').order('created_at',{ascending:true});
 if(error)throw new Error(error.message);
 let task=0;const subtasks=new Map<string,number>();let lastReturnedAt:string|undefined;
 for(const row of data??[]){
  const meta=(row.metadata??{}) as {scope?:string;subtaskId?:string|null;returned?:number};
  const amount=cents(meta.returned);if(!amount)continue;
  lastReturnedAt=row.created_at as string;
  if(meta.scope==='subtask'&&meta.subtaskId)subtasks.set(meta.subtaskId,(subtasks.get(meta.subtaskId)??0)+amount);
  else task+=amount;
 }
 const result:ReturnedBudget={task:task/100,subtasks:new Map([...subtasks].map(([id,value])=>[id,value/100])),lastReturnedAt};
 return task===0&&!subtasks.size?EMPTY:result;
}
