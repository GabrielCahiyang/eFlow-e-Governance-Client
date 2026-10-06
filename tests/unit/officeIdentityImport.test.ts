import { beforeEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc } }));
vi.mock('../../src/app/features/tasks', () => ({ notifyTaskListeners: vi.fn().mockRejectedValue(new Error('refresh failed')) }));
vi.mock('../../src/app/features/projects', () => ({ notifyProjectListeners: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/app/features/ai', () => ({ requestAiChat: vi.fn(), readAiText: vi.fn() }));
import { importReviewedProject, importReviewedProjectWithOffices, ProjectImportSaveError } from '../../src/app/features/project-import/services/projectImportService';
import { rowToTask, taskToRow } from '../../src/app/features/tasks/services/taskMapper';
beforeEach(() => { rpc.mockReset(); });
describe('Office identity import compatibility', () => {
  it('uses the versioned RPC for identity-aware import without changing legacy callers', async () => {
    const receipt = { taskCount: 1, subitemCount: 0, groupCount: 1, taskIds: { a: 'task' }, groupIds: ['group'] };
    rpc.mockResolvedValue({ data: receipt, error: null });
    expect(await importReviewedProjectWithOffices('p', 'batch', { offices: [] })).toEqual(receipt);
    expect(rpc).toHaveBeenLastCalledWith('phase65_import_project_work', { p_project_id: 'p', p_request_id: 'batch', p_review: { offices: [] } });
    await importReviewedProject('p', 'legacy', {});
    expect(rpc).toHaveBeenLastCalledWith('phase5_import_project_work', expect.any(Object));
  });
  it('never falls back to an unguarded import after the identity contract fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'RPC missing' } });
    await expect(importReviewedProjectWithOffices('p', 'batch', {})).rejects.toThrow('not available');
    expect(rpc).toHaveBeenCalledOnce();
  });
  it('keeps uncertain write outcomes on the same batch and distinguishes definite validation failures', async () => {
    rpc.mockResolvedValueOnce({ error: { code: '503', message: 'Network failed' } }).mockResolvedValueOnce({ error: { code: '42501', message: 'Head required' } });
    const uncertain = await importReviewedProjectWithOffices('p', 'b', {}).catch(e => e);
    expect(uncertain).toBeInstanceOf(ProjectImportSaveError);
    expect(uncertain.retrySameBatch).toBe(true);
    const denied = await importReviewedProjectWithOffices('p', 'b', {}).catch(e => e);
    expect(denied.retrySameBatch).toBe(false);
  });
  it('maps proposed responsibility read-only and excludes it from generic task writes', () => {
    const task = rowToTask({ id: 'task', org_id: 'canonical-anchor', proposed_office_identity_id: 'local-office' });
    expect(task.proposedOfficeIdentityId).toBe('local-office');
    expect(task.orgId).toBe('canonical-anchor');
    expect(taskToRow(task)).not.toHaveProperty('proposed_office_identity_id');
  });
});
