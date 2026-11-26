import {useState,type ReactNode} from 'react';
import type {Task} from '../../tasks';

import type {Subtask} from '../../../services/subtaskService';
import {WorkBudgetCard,WorkFinancialClearancePanel} from '../../budget';
import {SubtaskDeadlineEditor} from './SubtaskDeadlineEditor';
import {SubtaskProgressForm} from './SubtaskProgressForm';
import {SubtaskSubmissionHistory} from './SubtaskSubmissionHistory';
import type {SubtaskProgressUpdate,SubtaskSubmission} from '../types';
import type {selectSubitemInspectorCapabilities} from '../selectors/inspectorCapabilities';

export function SubitemWorkflow({task,subtask,prerequisite,capabilities,clearanceReadOnly,pending,saving,submissions,progressUpdates,onSaved,currentReviewerName,schedule,startPanel,leadReview,directUpdates=true,directCompletion=true,dependencyBlockedReason,recheckCompletion,recheckProgress}:{
 task:Task;subtask:Subtask;prerequisite:Subtask|null;capabilities:ReturnType<typeof selectSubitemInspectorCapabilities>;clearanceReadOnly:boolean;pending:boolean;saving?:boolean;
 submissions:SubtaskSubmission[];progressUpdates:SubtaskProgressUpdate[];onSaved:()=>Promise<void>;onReview:()=>void;
 currentReviewerName?:string;schedule?:ReactNode;startPanel?:ReactNode;leadReview?:ReactNode;directUpdates?:boolean;directCompletion?:boolean;dependencyBlockedReason?:string|null;recheckCompletion?:()=>Promise<void>;recheckProgress?:()=>Promise<void>;
}){
 const [clearanceAccepted,setClearanceAccepted]=useState(false);
 const showExecution=Boolean(startPanel||(directUpdates&&!clearanceAccepted));
 const showClearance=typeof WorkFinancialClearancePanel==='function'&&Boolean(task.linkedProjectId||task.orgId)&&Boolean(subtask.leadId)&&subtask.status!=='todo';
 const showChangesHistory=submissions.length>0&&subtask.status==='changes_requested';
 const hasExecutionTile=Boolean(leadReview||showExecution||showChangesHistory);
 return <>
  {showClearance&&(
   <div className="subitem-bento-clearance">
    <WorkFinancialClearancePanel root={task.id} node={subtask.id} readOnly={pending||clearanceReadOnly} onSaved={onSaved} onStatusChange={status=>setClearanceAccepted(Boolean(status?.workAccepted&&!status.completed))}/>
   </div>
  )}
  {hasExecutionTile&&(
   <div className={leadReview&&showExecution?'subitem-execution subitem-execution-stack':'subitem-execution'}>
    {leadReview}
    {showExecution&&<section aria-label="Execute subtask" className="space-y-2">
     {startPanel??<SubtaskProgressForm key={subtask.id} dependencyBlockedReason={dependencyBlockedReason} recheckCompletion={recheckCompletion} recheckProgress={recheckProgress} subtask={subtask} prerequisite={prerequisite} readOnly={!capabilities.execute} disabled={pending} showCompletion={directCompletion} canSubmit={capabilities.submit&&!pending} submitBlockedReason={capabilities.submit?(pending?(saving?'An update is being saved.':'Refreshing subtask access. Try again in a moment.'):null):capabilities.submitBlockedReason} onSaved={onSaved} initialBlocker={progressUpdates[0]?.blocker||''}/>}
    </section>}
    {showChangesHistory&&<details className="work-secondary" open><summary>Earlier evidence and feedback · {submissions.length}</summary><SubtaskSubmissionHistory submissions={submissions} currentReviewerName={currentReviewerName}/></details>}
   </div>
  )}
  <aside className={hasExecutionTile?'subitem-bento-schedule':'subitem-bento-schedule subitem-bento-full'} aria-label="Subtask schedule">
   <details className="subitem-details-panel" open><summary>Schedule</summary><fieldset disabled={pending} className="min-w-0">
    {schedule??<SubtaskDeadlineEditor subtask={subtask} parentTask={task} canManage={capabilities.editDetails} onSaved={onSaved}/>}
   </fieldset></details>
  </aside>
  <section className="subitem-bento-funding" aria-label="Subtask funding details">
   <details className="subitem-details-panel subitem-details-panel--bento" open><summary>Funding details</summary><WorkBudgetCard task={task} subtask={subtask} canManage={capabilities.manageBudget} readOnly={capabilities.budgetReadOnly} authorityPending={pending}/></details>
  </section>
 </>;
}
