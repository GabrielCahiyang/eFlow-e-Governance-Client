// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectOffice } from '../../src/app/features/project-offices/types';
import type { Organization, UserProfile } from '../../src/app/types';

const api = vi.hoisted(() => ({ canonical: vi.fn(), identities: vi.fn(), remove: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: {
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: api.remove,
} }));
vi.mock('../../src/app/features/project-offices/services/projectOfficeService', () => ({ fetchProjectOffices: api.canonical }));
vi.mock('../../src/app/features/project-offices/services/officeIdentityService', () => ({ fetchOfficeIdentities: api.identities }));
import { useProjectOffices } from '../../src/app/features/project-offices/hooks/useProjectOffices';
import { officeStaffingReason } from '../../src/app/features/project-offices/presentation';

const office = (project: string) => ({ id: project + '-office', project_id: project, office_id: 'own', invitation_status: 'joined', relationship_type: 'lead' } as ProjectOffice);
const roster = (project: string) => ({ offices: [office(project)], members: [{ project_office_id: project + '-office', user_id: 'member' }] });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(finish => { resolve = finish; }); return { promise, resolve }; }
async function settle() { await act(async () => { await Promise.resolve(); }); }

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); api.identities.mockResolvedValue([]); api.canonical.mockResolvedValue(roster('a')); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Office read settlement and recovery', () => {
  it('finishes initial loading on denial and recovers automatically after reconnect', async () => {
    const recovery = deferred<ReturnType<typeof roster>>();
    api.canonical.mockRejectedValueOnce(new Error('Participant source unavailable')).mockReturnValueOnce(recovery.promise);
    const { result } = renderHook(() => useProjectOffices('a'));
    expect(result.current.loading).toBe(true);
    await settle();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Participant source unavailable');
    expect(result.current.offices).toEqual([]);
    act(() => window.dispatchEvent(new Event('online')));
    expect(api.canonical).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Participant source unavailable');
    await act(async () => recovery.resolve(roster('a')));
    expect(result.current.error).toBe('');
    expect(result.current.offices[0].project_id).toBe('a');
    expect(result.current.members[0].user_id).toBe('member');
  });

  it('retains an initial error until an explicit source retry succeeds', async () => {
    api.canonical.mockRejectedValueOnce(new Error('Office denied')).mockResolvedValueOnce(roster('a'));
    const { result } = renderHook(() => useProjectOffices('a'));
    await settle();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Office denied');
    await act(async () => result.current.refresh());
    expect(api.canonical.mock.calls.map(call => call[0])).toEqual(['a', 'a']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('');
    expect(result.current.offices).toEqual(roster('a').offices);
  });

  it('keeps previously loaded rows on a refresh failure while denying staffing authority', async () => {
    const { result } = renderHook(() => useProjectOffices('a'));
    await settle();
    api.canonical.mockRejectedValueOnce(new Error('Authority source denied'));
    await act(async () => result.current.refresh());
    expect(result.current.loading).toBe(false);
    expect(result.current.offices).toEqual(roster('a').offices);
    expect(result.current.members).toEqual(roster('a').members);
    const head = { id: 'head', role: 'head', org_id: 'own', is_active: true } as UserProfile;
    const organizations = [{ id: 'own', head_user_id: 'head' }] as Organization[];
    expect(officeStaffingReason(result.current.offices[0], head, organizations, 'planning', false, result.current.error)).toContain('Refresh the authoritative Office data');
    await act(async () => result.current.refresh());
    expect(result.current.error).toBe('');
    expect(officeStaffingReason(result.current.offices[0], head, organizations, 'planning', false, result.current.error)).toBe('');
  });

  it('clears the previous project immediately and ignores its delayed completion', async () => {
    const stale = deferred<ReturnType<typeof roster>>(), current = deferred<ReturnType<typeof roster>>();
    const { result, rerender } = renderHook(({ project }) => useProjectOffices(project), { initialProps: { project: 'a' } });
    await settle();
    api.canonical.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise);
    let staleRefresh!: Promise<void>;
    act(() => { staleRefresh = result.current.refresh(); });
    rerender({ project: 'b' });
    expect(result.current.projectId).toBe('b');
    expect(result.current.loading).toBe(true);
    expect(result.current.offices).toEqual([]);
    expect(result.current.members).toEqual([]);
    await act(async () => { stale.resolve(roster('a')); await staleRefresh; });
    expect(result.current.projectId).toBe('b');
    expect(result.current.loading).toBe(true);
    expect(result.current.offices).toEqual([]);
    await act(async () => current.resolve(roster('b')));
    expect(result.current.loading).toBe(false);
    expect(result.current.offices.map(row => row.project_id)).toEqual(['b']);
    expect(result.current.error).toBe('');
    expect(api.remove).toHaveBeenCalledTimes(2);
  });
});
