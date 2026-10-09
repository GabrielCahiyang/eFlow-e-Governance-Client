import {Button} from '@vibe/core';
import {ProgressUpdateForm,type Task} from '../../tasks';
import {SubmitForReviewForm} from '../../reviews';
import type {Subtask} from '../../subtasks';
export function InspectorExecution({task,subtasks,canStart,canResume,canSubmit,canPostProgress,busy,onStart,onChanged,onSubmitted}:{task:Task;canStart:boolean;canResume:boolean;canSubmit:boolean;canPostProgress:boolean;busy:boolean;onStart:()=>void;onChanged?:()=>void;onSubmitted:()=>void;subtasks:Subtask[]}){
 return <div className="space-y-4">
  {canStart&&<div className="rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="text-sm">This task is ready to begin.</p><Button onClick={onStart} disabled={busy} size="small">{busy?'Starting…':'Start work'}</Button></div>}
  {task.status==='changes_requested'&&<div className="rounded-lg border border-rose-200 bg-rose-50 p-3"><h3 className="text-sm font-medium">Updates needed</h3>{task.rejectionNote&&<p className="text-sm">{task.rejectionNote}</p>}{canResume&&<Button onClick={onStart} disabled={busy} size="small">{busy?'Resuming…':'Resume work'}</Button>}</div>}
  {canPostProgress&&<ProgressUpdateForm taskId={task.id} initialPercent={task.percentComplete??0} onSaved={onChanged}/>}
  {canSubmit&&<SubmitForReviewForm task={task} subtasks={subtasks} onSubmitted={onSubmitted}/>}
 </div>;
}
