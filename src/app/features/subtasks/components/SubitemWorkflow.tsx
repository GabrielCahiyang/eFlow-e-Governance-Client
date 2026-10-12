import type {Task} from '../../tasks';
import type {Subtask} from '../../../services/subtaskService';
import {WorkBudgetCard} from '../../budget';
import {SubtaskDeadlineEditor} from './SubtaskDeadlineEditor';
import {SubtaskProgressForm} from './SubtaskProgressForm';
import {SubtaskProgressHistory} from './SubtaskProgressHistory';
import {SubtaskSubmissionHistory} from './SubtaskSubmissionHistory';
import type {SubtaskProgressUpdate,SubtaskSubmission} from '../types';
import type {selectSubitemInspectorCapabilities} from '../selectors/inspectorCapabilities';

export function SubitemWorkflow({task,subtask,prerequisite,capabilities,pending,submissions,progressUpdates,onSaved,onReview,currentReviewerName}:{
 task:Task;subtask:Subtask;prerequisite:Subtask|null;capabilities:ReturnType<typeof selectSubitemInspectorCapabilities>;pending:boolean;
 submissions:SubtaskSubmission[];progressUpdates:SubtaskProgressUpdate[];onSaved:()=>Promise<void>;onReview:()=>void;
 currentReviewerName?:string;
}){
 return <>
  <fieldset disabled={pending} className="min-w-0">
   <SubtaskDeadlineEditor subtask={subtask} parentTask={task} canManage={capabilities.editDetails} onSaved={onSaved}/>
  </fieldset>
  <WorkBudgetCard task={task} subtask={subtask} canManage={capabilities.manageBudget} readOnly={capabilities.budgetReadOnly} authorityPending={pending}/>
  <section aria-label="Execute subitem" className="space-y-2">
   <h3 className="text-sm font-semibold">Execute</h3>
   {!capabilities.execute&&<p role="status" className="text-sm">Progress is read-only in this view.</p>}
   <SubtaskProgressForm subtask={subtask} prerequisite={prerequisite} readOnly={!capabilities.execute||pending} canSubmit={capabilities.submit&&!pending} onSaved={onSaved}/>
  </section>
  {capabilities.review&&<button type="button" disabled={pending} onClick={onReview}>Review evidence</button>}
  <SubtaskProgressHistory updates={progressUpdates}/>
  <SubtaskSubmissionHistory submissions={submissions} currentReviewerName={currentReviewerName}/>
 </>;
}
