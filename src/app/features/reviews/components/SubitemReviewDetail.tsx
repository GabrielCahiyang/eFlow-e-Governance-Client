import { CheckCircle2, MessageSquareWarning, FileCheck2 } from 'lucide-react';
import {Button} from '@vibe/core';
import {formatDate} from '../../../components/workflow/primitives';
import { SubtaskEvidenceLink, type SubtaskReviewItem } from '../../subtasks';
import './subitemReview.css';

/** Caller supplies only already-authorized context; this view discovers no authority. */
export interface SubitemReviewContext {
  taskId: string;
  subtaskId: string;
  rootTitle: string;
  path: readonly { id: string; title: string }[];
  parentTitle?: string;
  incomplete?: boolean;
  currentReviewerName?: string | null;
}
export interface SubitemReviewDetailProps {
  item: SubtaskReviewItem;
  context?: SubitemReviewContext;
  currentReviewerName?: string;
  feedback: string;
  pending: boolean;
  readOnly: boolean;
  /** A retained draft is not fresh permission to read its old evidence. */
  evidenceAvailable?: boolean;
  onFeedbackChange: (value: string) => void;
  onApprove: () => void;
  onRequestChanges: () => void;
}

export function SubitemReviewDetail({item,context,currentReviewerName,feedback,pending,readOnly,evidenceAvailable=true,onFeedbackChange,onApprove,onRequestChanges}:SubitemReviewDetailProps) {
  const verified = context?.taskId === item.subtask.taskId && context.subtaskId === item.subtask.id ? context : undefined;
  const candidate=item.subtask.workContext;
  const metadata=candidate?.rootId===item.subtask.taskId&&candidate.nodeId===item.subtask.id?candidate:undefined;
  const blocked = readOnly || pending;
  const reviewer = verified ? verified.currentReviewerName : currentReviewerName;

  return <section aria-label="Subitem review detail" className="subitem-review-detail space-y-4 rounded-xl border p-4">
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-neutral-400">Subtask evidence · Attempt {item.submission.version}</div>
      <h2 className="mt-1 text-[17px] font-semibold text-neutral-900">{item.subtask.title}</h2>

      <nav aria-label="Review work path" className="break-words text-sm">
        {verified ? <>{verified.rootTitle}{verified.incomplete && ' / Parent context unavailable'}{verified.path.map(part => <span key={part.id}> / {part.title}</span>)}</> : metadata?.pathLabel || <>{item.taskTitle}{item.subtask.parentSubtaskId && ' / Parent context unavailable'} / {item.subtask.title}</>}
      </nav>

      <p className="text-sm">Reviewer: {reviewer || 'Checking current reviewer…'}</p>
      {metadata&&<details className="work-secondary"><summary>Team details</summary><p className="text-sm">Lead: {metadata.leadName||'Needs reassignment'} · Contributors ({metadata.contributors.length}): {metadata.contributors.map(person=>person.name).join(', ')||'No contributors'}</p></details>}
    </div>
    <div className="subitem-review-note rounded-lg border p-3">
      <div className="text-[11px] text-neutral-500">Submitted by {item.submission.submitterName} · {formatDate(item.submission.submittedAt)}</div>
      <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-neutral-800">{item.submission.note}</p>
      {(item.submission.decidedByName || item.submission.status !== 'pending') && <p className="mt-2 text-sm">Historical decision by {item.submission.decidedByName || 'Reviewer unavailable'} · {item.submission.status.replace('_',' ')}</p>}
      {item.submission.decisionFeedback && <p className="whitespace-pre-wrap text-sm">{item.submission.decisionFeedback}</p>}
    </div>
    <div>
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500">Evidence files</div>
      {!evidenceAvailable&&<p role="status">Evidence unavailable until current review access is verified.</p>}
      <div className="review-evidence-grid">{item.submission.attachments.map(attachment => evidenceAvailable?<div className="review-evidence-card" key={attachment.id || attachment.filePath}><FileCheck2 size={28}/><SubtaskEvidenceLink fileName={attachment.fileName} filePath={attachment.filePath}/></div>:<span key={attachment.id||attachment.filePath}>{attachment.fileName}</span>)}</div>
    </div>
    <div className="review-decision-footer">
      <label className="text-[10.5px] font-medium text-neutral-500">Feedback (required when requesting changes)
        <textarea maxLength={4000} aria-label="Review feedback" value={feedback} disabled={blocked} onChange={event => onFeedbackChange(event.target.value)} placeholder="Explain what needs correction…" className="mt-1 min-h-20 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[12px] outline-none focus:border-neutral-500"/>
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <Button kind="secondary" onClick={() => {if(!blocked && feedback.trim())onRequestChanges();}} disabled={blocked || !feedback.trim()}><MessageSquareWarning size={13}/> Request changes</Button>
        <Button onClick={() => {if(!blocked)onApprove();}} disabled={blocked}><CheckCircle2 size={13}/> {pending ? 'Saving…' : 'Approve evidence'}</Button>
      </div>
    </div>
  </section>;
}
