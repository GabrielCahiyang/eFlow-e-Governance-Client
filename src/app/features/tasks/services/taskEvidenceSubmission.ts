import { supabase } from '../../../../lib/supabase';
import { assertActionActor } from '../../../shared/actionActor';
import { attachmentError } from '../../../shared/fileValidation';
import { MutationRejectedError } from '../../../shared/MutationRejectedError';
import { isCommandId, pendingActionKey, readPendingAction, removePendingAction, withPendingActionLock, writePendingAction } from '../../../shared/pendingActionStore';
import type { TaskSubmissionAttachment, TaskSubmissionInput } from '../taskTypes';
import { assertLeadershipReviewReady, assertTaskSubtasksReady } from './leadershipReviewReadinessService';
import { notifyTaskListeners } from './taskRealtimeService';
import { checkTaskExecution } from './taskExecutionAccess';

export const taskEvidenceActionKey = (actor: string, task: string) => pendingActionKey(actor, 'task-evidence', task);

export interface TaskEvidenceAttempt {
  id: string;
  note: string;
  files: File[];
  office: string | null;
  project: string | null;
}

async function hasReceipt(task: string, actor: string, id: string) {
  await assertActionActor(actor);
  const { data, error } = await supabase.from('task_submissions').select('id,task_id,submitter_id')
    .eq('id', id).eq('task_id', task).maybeSingle();
  if (error) throw new Error(error.message);
  if (data && (data.id !== id || data.task_id !== task || data.submitter_id !== actor)) {
    throw new Error('The original evidence receipt does not match this task and account.');
  }
  return !!data;
}

async function clearPending(key: string) {
  await removePendingAction(key);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eflow:pending-action', { detail: key }));
  }
}

function isValidAttempt(attempt: unknown): attempt is TaskEvidenceAttempt {
  if (!attempt || typeof attempt !== 'object') return false;
  const candidate = attempt as Partial<TaskEvidenceAttempt>;
  return isCommandId(candidate.id) && Array.isArray(candidate.files) && typeof candidate.note === 'string' && candidate.note.trim().length > 0;
}

function sameFiles(nextFiles: File[], savedFiles: File[]): boolean {
  if (nextFiles.length !== savedFiles.length) return false;
  return nextFiles.every((file, index) => {
    const saved = savedFiles[index];
    return Boolean(saved) && file.name === saved.name && file.size === saved.size && file.lastModified === saved.lastModified;
  });
}

async function sendEvidence(
  task: string,
  actor: string,
  attempt: TaskEvidenceAttempt,
  verifyOnly: boolean,
  onRpcAttempt: () => void,
) {
  if (!isValidAttempt(attempt)) throw new Error('The saved evidence could not be verified.');
  if (await hasReceipt(task, actor, attempt.id)) return;
  if (verifyOnly) throw new Error('No saved submission was found. Current task execution access is required to continue sending it.');
  const scope = await checkTaskExecution(task, actor, ['todo', 'in_progress', 'changes_requested']);
  if ((scope.org_id ?? null) !== attempt.office || (scope.linked_project_id ?? null) !== attempt.project) {
    throw new Error('The task moved to a different Office or project. The original submission could not be recovered here.');
  }
  await assertTaskSubtasksReady(task);
  await assertLeadershipReviewReady(task);
  const attachments: TaskSubmissionAttachment[] = [];
  const bucket = supabase.storage.from('task-attachments');
  for (const [index, file] of attempt.files.entries()) {
    await assertActionActor(actor);
    const filePath = `${task}/${attempt.id}/${index}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await bucket.upload(filePath, file, { upsert: false, contentType: file.type || undefined });
    if (error) {
      const existing = typeof bucket.info === 'function' ? await bucket.info(filePath) : { error, data: null };
      if (existing.error || existing.data?.size !== file.size) {
        const detail = typeof error.message === 'string' && error.message.trim() ? `: ${error.message.trim()}` : '. Please try again.';
        throw new Error(`Could not upload "${file.name}"${detail}`);
      }
    }
    attachments.push({ fileName: file.name, filePath, fileSize: file.size, mimeType: file.type });
  }
  const latest = await checkTaskExecution(task, actor, ['todo', 'in_progress', 'changes_requested']);
  if (scope.org_id !== latest.org_id || scope.linked_project_id !== latest.linked_project_id) {
    throw new Error('The task moved to a different Office or project. Check the original submission before continuing.');
  }
  onRpcAttempt();
  const { data, error } = await supabase.rpc('submit_task_for_review', {
    p_task_id: task, p_submission: { id: attempt.id, note: attempt.note, attachments },
  });
  if (!error && data?.id === task && data.latest_submission?.id === attempt.id && data.latest_submission?.submitterId === actor) return;
  if (await hasReceipt(task, actor, attempt.id)) return;
  if (error && /^(22|23|28|42|P0)/.test(error.code || '')) {
    const message = /Assign an eligible reviewer before submitting/i.test(error.message)
      ? 'Assign an independent Task reviewer before submitting the work.' : error.message;
    throw new MutationRejectedError(message, error.code);
  }
  throw new Error('The submission outcome could not be confirmed. Check the saved evidence submission.');
}

async function runSubmission(task: string, actor: string, submission?: TaskSubmissionInput, verifyOnly = false) {
  const key = taskEvidenceActionKey(actor, task);
  await withPendingActionLock(key, async () => {
    await assertActionActor(actor);
    let attempt = await readPendingAction<TaskEvidenceAttempt>(key);
    if (attempt && !isValidAttempt(attempt)) {
      await clearPending(key);
      attempt = undefined;
    }
    if (attempt && submission) {
      const matchesSaved = submission.note.trim() === attempt.note && sameFiles(submission.attachments || [], attempt.files);
      if (!matchesSaved) {
        if (await hasReceipt(task, actor, attempt.id)) {
          await clearPending(key);
          await notifyTaskListeners();
          return;
        }
        // Confirmed not saved on the server; clear the stale unsent attempt so the user can submit fresh evidence.
        await clearPending(key);
        attempt = undefined;
      }
    }
    if (!attempt && !submission) throw new Error('There is no saved evidence submission to check.');
    if (!attempt && submission) {
      const issue = attachmentError(submission.attachments || []);
      if (issue) throw new Error(issue);
      if (submission.note.length > 5000) throw new Error('Completion note must be 5,000 characters or fewer.');
      if (!submission.note.trim()) throw new Error('Submission note is required.');
      const current = await checkTaskExecution(task, actor, ['todo', 'in_progress', 'changes_requested']);
      await assertTaskSubtasksReady(task);
      await assertLeadershipReviewReady(task);
      attempt = { id: crypto.randomUUID(), note: submission.note.trim(), files: submission.attachments || [],
        office: typeof current.org_id === 'string' ? current.org_id : null,
        project: typeof current.linked_project_id === 'string' ? current.linked_project_id : null,
      };
      await writePendingAction(key, attempt, true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('eflow:pending-action', { detail: key }));
      }
    }
    let rpcAttempted = false;
    try { await sendEvidence(task, actor, attempt!, verifyOnly, () => { rpcAttempted = true; }); }
    catch (error) {
      if (!rpcAttempted || error instanceof MutationRejectedError) {
        await clearPending(key);
      }
      throw error;
    }
    await clearPending(key);
    await notifyTaskListeners();
  });
}

export const submitTaskForReview = (task: string, submission: TaskSubmissionInput) =>
  runSubmission(task, submission.submitterId, submission);

export const recoverTaskEvidence = (task: string, actor: string, verifyOnly = false) => runSubmission(task, actor, undefined, verifyOnly);

export async function discardTaskEvidenceAttempt(task: string, actor: string): Promise<'recovered' | 'discarded'> {
  const key = taskEvidenceActionKey(actor, task);
  return withPendingActionLock(key, async () => {
    await assertActionActor(actor);
    const attempt = await readPendingAction<TaskEvidenceAttempt>(key);
    if (attempt && isValidAttempt(attempt) && await hasReceipt(task, actor, attempt.id)) {
      await clearPending(key);
      await notifyTaskListeners();
      return 'recovered';
    }
    await clearPending(key);
    return 'discarded';
  });
}
