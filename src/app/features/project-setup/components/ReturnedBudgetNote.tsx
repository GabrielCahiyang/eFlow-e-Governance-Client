import {useReturnedBudget} from '../hooks/useReturnedBudget';

const peso=(amount:number)=>`₱${amount.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

/** Explains that unused budget on finished work went back to the project. */
export function ReturnedBudgetNote({taskId,subtaskId,finished}:{taskId:string;subtaskId?:string;finished:boolean}){
 const returned=useReturnedBudget(taskId,finished);
 const amount=subtaskId?returned.subtasks.get(subtaskId)??0:returned.task;
 if(!finished||amount<=0)return null;
 return <p role="status" className="pf-task-budget-note">
  {peso(amount)} of the unused {subtaskId?'subtask':'task'} budget was returned to the project budget when this work was completed.
 </p>;
}
