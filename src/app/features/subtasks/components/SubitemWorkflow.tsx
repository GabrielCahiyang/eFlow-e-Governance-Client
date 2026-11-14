import type {ReactNode} from 'react';
import type {Task} from '../../tasks';

import type {Subtask} from '../../../services/subtaskService';
import {WorkBudgetCard} from '../../budget';
import {SubtaskDeadlineEditor} from './SubtaskDeadlineEditor';
import {SubtaskProgressForm} from './SubtaskProgressForm';
import {SubtaskProgressHistory} from './SubtaskProgressHistory';
import {SubtaskSubmissionHistory} from './SubtaskSubmissionHistory';
import type {SubtaskProgressUpdate,SubtaskSubmission} from '../types';
import type {selectSubitemInspectorCapabilities} from '../selectors/inspectorCapabilities';

export function SubitemWorkflow({task,subtask,prerequisite,capabilities,pending,saving,submissions,progressUpdates,onSaved,currentReviewerName,schedule,startPanel,leadReview,directUpdates=true,directCompletion=true}:{
 task:Task;subtask:Subtask;prerequisite:Subtask|null;capabilities:ReturnType<typeof selectSubitemInspectorCapabilities>;pending:boolean;saving?:boolean;
 submissions:SubtaskSubmission[];progressUpdates:SubtaskProgressUpdate[];onSaved:()=>Promise<void>;onReview:()=>void;
 currentReviewerName?:string;schedule?:ReactNode;startPanel?:ReactNode;leadReview?:ReactNode;directUpdates?:boolean;directCompletion?:boolean;
}){
 return <>
  <div className="subitem-execution">
  {leadReview}
  {(startPanel||directUpdates)&&<section aria-label="Execute subtask" className="space-y-2">
   {startPanel??<SubtaskProgressForm subtask={subtask} prerequisite={prerequisite} readOnly={!capabilities.execute} disabled={pending} showCompletion={directCompletion} canSubmit={capabilities.submit&&!pending} submitBlockedReason={capabilities.submit?(pending?(saving?'An update is being saved.':'Refreshing subtask access. Try again in a moment.'):null):capabilities.submitBlockedReason} onSaved={onSaved} initialBlocker={progressUpdates[0]?.blocker||''}/>}
  </section>}
  {progressUpdates.length>0&&<details className="work-secondary"><summary>Updates · {progressUpdates.length}</summary><SubtaskProgressHistory updates={progressUpdates}/></details>}
  {submissions.length>0&&<details className="work-secondary" open={subtask.status==='changes_requested'}><summary>Earlier evidence and feedback · {submissions.length}</summary><SubtaskSubmissionHistory submissions={submissions} currentReviewerName={currentReviewerName}/></details>}
  </div>
  <aside className="subitem-details" aria-label="Subtask funding and schedule">
   <details className="subitem-details-panel" open><summary>Funding details</summary><WorkBudgetCard task={task} subtask={subtask} canManage={capabilities.manageBudget} readOnly={capabilities.budgetReadOnly} authorityPending={pending}/></details>
   <details className="subitem-details-panel"><summary>Schedule</summary><fieldset disabled={pending} className="min-w-0">
    {schedule??<SubtaskDeadlineEditor subtask={subtask} parentTask={task} canManage={capabilities.editDetails} onSaved={onSaved}/>}
   </fieldset></details>
  </aside>
 </>;
}
