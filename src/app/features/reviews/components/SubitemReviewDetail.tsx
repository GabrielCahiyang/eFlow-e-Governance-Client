import { CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { SubtaskEvidenceLink, type SubtaskReviewItem } from '../../subtasks';

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
  const parent = verified?.parentTitle || (metadata?.parentId?metadata.path.find(part=>part.id===metadata.parentId)?.title:undefined) || (item.subtask.parentSubtaskId ? 'Parent unavailable' : item.taskTitle);
  return <section aria-label="Subitem review detail" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-neutral-400">Subtask evidence · Attempt {item.submission.version}</div>
      <h2 className="mt-1 text-[17px] font-semibold text-neutral-900">{item.subtask.title}</h2>
      <div className="mt-1 text-[11.5px] text-neutral-500">Parent task: {item.taskTitle}{item.projectTitle ? ` · ${item.projectTitle}` : ''}</div>
      <p className="text-sm">Parent: {parent}</p>
      <nav aria-label="Review work path" className="break-words text-sm">
        {verified ? <>{verified.rootTitle}{verified.incomplete && ' / Parent context unavailable'}{verified.path.map(part => <span key={part.id}> / {part.title}</span>)}</> : metadata?.pathLabel || <>{item.taskTitle}{item.subtask.parentSubtaskId && ' / Parent context unavailable'} / {item.subtask.title}</>}
      </nav>
      <p className="text-sm">Progress: {typeof item.subtask.percentComplete === 'number' ? `${item.subtask.percentComplete}%` : 'Unavailable'}</p>
      <p className="text-sm">Current reviewer: {reviewer || 'Current reviewer unavailable'}</p>
      {metadata&&<p className="text-sm">Lead: {metadata.leadName||'Needs reassignment'} · Contributors ({metadata.contributors.length}): {metadata.contributors.map(person=>person.name).join(', ')||'No contributors'}</p>}
    </div>
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="text-[11px] text-neutral-500">Submitted by {item.submission.submitterName}</div>
      <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-neutral-800">{item.submission.note}</p>
      {(item.submission.decidedByName || item.submission.status !== 'pending') && <p className="mt-2 text-sm">Historical decision by {item.submission.decidedByName || 'Reviewer unavailable'} · {item.submission.status.replace('_',' ')}</p>}
      {item.submission.decisionFeedback && <p className="whitespace-pre-wrap text-sm">{item.submission.decisionFeedback}</p>}
    </div>
    <div>
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500">Evidence files</div>
      {!evidenceAvailable&&<p role="status">Evidence unavailable until current review access is verified.</p>}
      <div className="space-y-2">{item.submission.attachments.map(attachment => evidenceAvailable?<SubtaskEvidenceLink key={attachment.id || attachment.filePath} fileName={attachment.fileName} filePath={attachment.filePath}/>:<span key={attachment.id||attachment.filePath}>{attachment.fileName}</span>)}</div>
    </div>
    <div className="border-t border-neutral-100 pt-4">
      <label className="text-[10.5px] font-medium text-neutral-500">Feedback (required when requesting changes)
        <textarea value={feedback} disabled={blocked} onChange={event => onFeedbackChange(event.target.value)} placeholder="Explain what needs correction…" className="mt-1 min-h-20 w-full rounded-lg border border-neutral-200 px-3 py-2 text-[12px] outline-none focus:border-neutral-500"/>
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => {if(!blocked && feedback.trim())onRequestChanges();}} disabled={blocked || !feedback.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11.5px] text-rose-700 hover:bg-rose-50 disabled:opacity-40"><MessageSquareWarning size={13}/> Request changes</button>
        <button type="button" onClick={() => {if(!blocked)onApprove();}} disabled={blocked} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[11.5px] text-white hover:bg-neutral-800 disabled:opacity-40"><CheckCircle2 size={13}/> {pending ? 'Saving…' : 'Approve evidence'}</button>
      </div>
    </div>
  </section>;
}
