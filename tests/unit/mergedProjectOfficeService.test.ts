import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ read: vi.fn(), rpc: vi.fn(), refresh: vi.fn(), columns: [] as { table: string; fields: string }[] }));
vi.mock('../../src/lib/supabase', () => ({ supabase: {
  auth: { refreshSession: api.refresh },
  rpc: api.rpc,
  from: (table: string) => ({ select: (fields: string) => {
    api.columns.push({ table, fields });
    return { eq: () => ({ order: () => api.read(table) }), in: () => api.read(table) };
  } }),
} }));
vi.mock('../../src/app/features/tasks', () => ({ notifyTaskListeners: vi.fn() }));
import { fetchProjectOffices, selectProjectOfficeMembersChecked } from '../../src/app/features/project-offices/services/projectOfficeService';

beforeEach(() => {
  vi.clearAllMocks(); api.columns.length = 0;
  api.refresh.mockResolvedValue({ data: { session: { user: { id: 'head' } } }, error: null });
});

describe('merged Office membership and session recovery', () => {
  it('recovers a membership read and still excludes ended and expired access terms', async () => {
    let membershipAttempts = 0;
    api.read.mockImplementation(async (table: string) => {
      if (table === 'project_offices') return { data: [{ id: 'office' }], error: null };
      if (++membershipAttempts === 1) return { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
      return { error: null, data: [
        { project_office_id: 'office', user_id: 'current', access_end: null, access_ended_at: null },
        { project_office_id: 'office', user_id: 'legacy' },
        { project_office_id: 'office', user_id: 'ended', access_ended_at: '2026-01-01T00:00:00Z' },
        { project_office_id: 'office', user_id: 'expired', access_end: '2000-01-01T00:00:00Z' },
      ] };
    });
    const result = await fetchProjectOffices('project');
    expect(result.members.map(member => member.user_id)).toEqual(['current', 'legacy']);
    expect(api.columns.filter(query => query.table === 'project_office_members').map(query => query.fields)).toEqual(['*', '*']);
    expect(api.refresh).toHaveBeenCalledOnce();
    expect(membershipAttempts).toBe(2);
  });

  it('retries an expired R7 membership write with the original request and expected roster', async () => {
    api.rpc.mockResolvedValueOnce({ error: { code: 'PGRST301', message: 'JWT expired' } })
      .mockResolvedValueOnce({ data: ['member'], error: null });
    await selectProjectOfficeMembersChecked('office', ['member'], ['old-member'], 'original-request');
    expect(api.rpc.mock.calls).toEqual(Array(2).fill(['r7_select_office_members', {
      p_office: 'office', p_users: ['member'], p_expected: ['old-member'], p_request: 'original-request',
    }]));
    expect(api.refresh).toHaveBeenCalledOnce();
  });

  it('keeps business denials and missing receipts from falling back to an unchecked write', async () => {
    api.rpc.mockResolvedValueOnce({ error: { message: 'Own appointed Head required' } });
    await expect(selectProjectOfficeMembersChecked('office', [], [], 'request')).rejects.toThrow('Own appointed Head');
    expect(api.rpc).toHaveBeenCalledOnce();
    api.rpc.mockClear(); api.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(selectProjectOfficeMembersChecked('office', [], [], 'request')).rejects.toThrow('Missing membership receipt');
    expect(api.rpc).toHaveBeenCalledOnce();
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('retains the legacy fallback only when the R7 operation is not installed', async () => {
    api.rpc.mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'Missing function' } })
      .mockResolvedValueOnce({ data: null, error: null });
    await selectProjectOfficeMembersChecked('office', ['member'], [], 'request');
    expect(api.rpc.mock.calls.map(call => call[0])).toEqual(['r7_select_office_members', 'phase6_set_members']);
    expect(api.refresh).not.toHaveBeenCalled();
  });
});
