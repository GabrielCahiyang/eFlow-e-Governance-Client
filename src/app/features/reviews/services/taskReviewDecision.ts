import { assertActionActor } from '../../../shared/actionActor';
import { fetchTaskById, rowToTask, type Task } from '../../tasks';
import { canUserReviewTask } from '../selectors';
import type { ReviewSubmission } from '../types';
import { fetchTaskSubmissions } from './reviewService';

export async function assertCurrentTaskReview(
  task: Task, submission: ReviewSubmission, actor: string, role?: string,
) {
  await assertActionActor(actor);
  const [row, [latest]] = await Promise.all([fetchTaskById(task.id), fetchTaskSubmissions(task.id)]);
  const current = row && !row.deleted_at && rowToTask(row);
  if (!current || current.status !== 'for_review' || current.archivedAt ||
      current.orgId !== task.orgId || current.linkedProjectId !== task.linkedProjectId ||
      latest?.id !== submission.id || latest.version !== submission.version || latest.status !== 'pending' ||
      !canUserReviewTask({ ...current, latestSubmission: {
        ...latest, attachments: [],
      } }, actor, role)) {
    throw new Error('This submission or your review access changed. Refresh before deciding.');
  }
  await assertActionActor(actor);
}

export async function readTaskReviewDecision(taskId: string, submissionId: string, actor: string, approve: boolean) {
  await assertActionActor(actor);
  const history = await fetchTaskSubmissions(taskId);
  const selected = history.find(item => item.id === submissionId);
  if (selected?.decidedBy === actor && selected.status === (approve ? 'approved' : 'changes_requested')) return 'saved';
  if (history[0]?.id === submissionId && selected?.status === 'pending') return 'pending';
  return 'changed';
}
