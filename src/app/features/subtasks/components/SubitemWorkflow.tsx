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
  <details className="work-secondary"><summary>Schedule</summary><fieldset disabled={pending} className="min-w-0">
   <SubtaskDeadlineEditor subtask={subtask} parentTask={task} canManage={capabilities.editDetails} onSaved={onSaved}/>
  </fieldset></details>
  <details className="work-secondary"><summary>Funding details</summary><WorkBudgetCard task={task} subtask={subtask} canManage={capabilities.manageBudget} readOnly={capabilities.budgetReadOnly} authorityPending={pending}/></details>
  <section aria-label="Execute subitem" className="space-y-2">
   <SubtaskProgressForm subtask={subtask} prerequisite={prerequisite} readOnly={!capabilities.execute} disabled={pending} canSubmit={capabilities.submit&&!pending} onSaved={onSaved} initialBlocker={progressUpdates[0]?.blocker||''}/>
  </section>
  {capabilities.review&&<button type="button" disabled={pending} onClick={onReview}>Review evidence</button>}
  {progressUpdates.length>0&&<details className="work-secondary"><summary>Updates · {progressUpdates.length}</summary><SubtaskProgressHistory updates={progressUpdates}/></details>}
  {submissions.length>0&&<details className="work-secondary" open={subtask.status==='changes_requested'}><summary>Submissions and feedback · {submissions.length}</summary><SubtaskSubmissionHistory submissions={submissions} currentReviewerName={currentReviewerName}/></details>}
 </>;
}
