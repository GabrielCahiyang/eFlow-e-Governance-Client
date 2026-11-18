// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { recoverTaskEvidence, submitTaskForReview, taskEvidenceActionKey } from '../../src/app/features/tasks/services/taskEvidenceSubmission';
import { readPendingAction, removePendingAction } from '../../src/app/shared/pendingActionStore';

const api = vi.hoisted(() => ({ actor: 'lead', receipt: vi.fn(), rpc: vi.fn(), upload: vi.fn(), notify: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: {
  auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: api.actor } } }, error: null }) },
  from: () => { const query = { select: () => query, eq: () => query, maybeSingle: api.receipt }; return query; },
  rpc: api.rpc, storage: { from: () => ({ upload: api.upload }) },
} }));
vi.mock('../../src/app/features/tasks/services/taskExecutionAccess', () => ({ checkTaskExecution: async () => ({}) }));
vi.mock('../../src/app/features/tasks/services/leadershipReviewReadinessService', () => ({
  assertTaskSubtasksReady: vi.fn(), assertLeadershipReviewReady: vi.fn(),
}));
vi.mock('../../src/app/features/tasks/services/taskRealtimeService', () => ({ notifyTaskListeners: api.notify }));

const key = taskEvidenceActionKey('lead', 'task');
beforeEach(async () => {
  vi.resetAllMocks();
  await removePendingAction(key);
  api.actor = 'lead';
  api.receipt.mockResolvedValue({ data: null, error: null });
  api.upload.mockResolvedValue({ error: null });
});

it('recovers the exact committed submission after a lost response without uploading or writing again', async () => {
  api.rpc.mockRejectedValueOnce(new Error('Connection lost'));
  await expect(submitTaskForReview('task', {
    note: 'Completed', submitterId: 'lead', submitterName: 'Lead',
    attachments: [new File(['evidence'], 'evidence.pdf', { type: 'application/pdf' })],
  })).rejects.toThrow('Connection lost');
  const original = api.rpc.mock.calls[0][1].p_submission;
  expect(await readPendingAction(key)).toMatchObject({ id: original.id, note: 'Completed' });

  api.actor = 'different-user';
  await expect(recoverTaskEvidence('task', 'lead')).rejects.toThrow('original account');
  api.actor = 'lead';
  api.receipt.mockResolvedValue({ data: { id: original.id, task_id: 'task', submitter_id: 'lead' }, error: null });
  await recoverTaskEvidence('task', 'lead');
  expect(api.upload).toHaveBeenCalledOnce();
  expect(api.rpc).toHaveBeenCalledOnce();
  expect(api.notify).toHaveBeenCalledOnce();
  expect(await readPendingAction(key)).toBeUndefined();
});
