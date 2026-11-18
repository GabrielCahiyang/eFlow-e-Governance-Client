// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import {
  discardTaskEvidenceAttempt,
  recoverTaskEvidence,
  submitTaskForReview,
  taskEvidenceActionKey,
} from '../../src/app/features/tasks/services/taskEvidenceSubmission';
import { readPendingAction, removePendingAction, writePendingAction } from '../../src/app/shared/pendingActionStore';

const api = vi.hoisted(() => ({ actor: 'lead', receipt: vi.fn(), rpc: vi.fn(), upload: vi.fn(), info: vi.fn(), notify: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: {
  auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: api.actor } } }, error: null }) },
  from: () => { const query = { select: () => query, eq: () => query, maybeSingle: api.receipt }; return query; },
  rpc: api.rpc, storage: { from: () => ({ upload: api.upload, info: api.info }) },
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
  api.info.mockResolvedValue({ data: null, error: { message: 'Not found' } });
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

it('replaces a stale unsent draft when submitting fresh evidence instead of permanently blocking the user', async () => {
  const staleId = '11111111-2222-4333-8444-555555555555';
  await writePendingAction(key, {
    id: staleId,
    note: 'Old unsent draft',
    files: [new File(['old'], 'old.pdf', { type: 'application/pdf' })],
    office: null,
    project: null,
  });
  api.receipt.mockResolvedValue({ data: null, error: null });
  api.rpc.mockImplementationOnce(async (_fn: string, params: { p_submission: { id: string } }) => ({
    data: { id: 'task', latest_submission: { id: params.p_submission.id, submitterId: 'lead' } },
    error: null,
  }));

  await submitTaskForReview('task', {
    note: 'done',
    submitterId: 'lead',
    submitterName: 'Lead',
    attachments: [new File(['new'], 'eFlow_Web_Wording_Changes.pdf', { type: 'application/pdf' })],
  });

  expect(api.upload).toHaveBeenCalledOnce();
  expect(api.rpc).toHaveBeenCalledOnce();
  expect(api.rpc.mock.calls[0][1].p_submission.note).toBe('done');
  expect(api.rpc.mock.calls[0][1].p_submission.id).not.toBe(staleId);
  expect(await readPendingAction(key)).toBeUndefined();
});

it('clears the pending attempt when file upload fails before the review RPC is called', async () => {
  api.upload.mockResolvedValueOnce({ error: { message: 'Storage policy denied' } });

  await expect(submitTaskForReview('task', {
    note: 'done',
    submitterId: 'lead',
    submitterName: 'Lead',
    attachments: [new File(['new'], 'eFlow_Web_Wording_Changes.pdf', { type: 'application/pdf' })],
  })).rejects.toThrow('Storage policy denied');

  expect(api.rpc).not.toHaveBeenCalled();
  expect(await readPendingAction(key)).toBeUndefined();
});

it('discards an unsent draft cleanly while safely recovering an already-committed draft', async () => {
  const staleId = '22222222-2222-4333-8444-555555555555';
  await writePendingAction(key, {
    id: staleId,
    note: 'Unsent draft',
    files: [],
    office: null,
    project: null,
  });

  await expect(discardTaskEvidenceAttempt('task', 'lead')).resolves.toBe('discarded');
  expect(await readPendingAction(key)).toBeUndefined();

  await writePendingAction(key, {
    id: staleId,
    note: 'Committed draft',
    files: [],
    office: null,
    project: null,
  });
  api.receipt.mockResolvedValueOnce({ data: { id: staleId, task_id: 'task', submitter_id: 'lead' }, error: null });
  await expect(discardTaskEvidenceAttempt('task', 'lead')).resolves.toBe('recovered');
  expect(api.notify).toHaveBeenCalledOnce();
  expect(await readPendingAction(key)).toBeUndefined();
});
