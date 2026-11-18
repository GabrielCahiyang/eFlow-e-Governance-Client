// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  readProjectFlow: vi.fn(),
  refreshProjectFlow: vi.fn(),
  realtimeListeners: new Map<string, () => void>(),
  user: { id: 'user-1' } as { id: string } | null,
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({ user: api.user }),
}));

vi.mock('../../src/app/features/project-setup/services/projectFlow', () => {
  class ProjectFlowError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
  return {
    ProjectFlowError,
    readProjectFlow: api.readProjectFlow,
    refreshProjectFlow: api.refreshProjectFlow,
    subscribeProjectFlowChanges: (projectId: string, onChanged: () => void) => {
      api.realtimeListeners.set(projectId, onChanged);
      return () => {
        api.realtimeListeners.delete(projectId);
      };
    },
  };
});

import { ProjectFlowError } from '../../src/app/features/project-setup/services/projectFlow';
import { useProjectFlow } from '../../src/app/features/project-setup/useProjectFlow';
import { resetAuthCaches } from '../../src/app/shared/authCacheReset';
import type { ProjectFlow } from '../../src/app/features/project-setup/types';

function makeFlowSnapshot(overrides: Partial<ProjectFlow> = {}): ProjectFlow {
  return {
    project: {
      id: 'proj-1',
      status: 'active',
      title: 'OutReach',
      description: 'Community outreach',
      scope: 'Barangay visits',
      project_lead_id: 'lead-1',
      start_date: '2026-11-18',
      target_date: '2027-02-18',
      funding_not_required: false,
      updated_at: '2026-11-18T00:00:00Z',
    },
    ready: true,
    canAuthorize: true,
    canAllocate: true,
    funds: [],
    sources: [],
    total: 500,
    allocated: 500,
    unallocated: 0,
    released: 0,
    spent: 0,
    requests: [],
    taskFunding: [],
    liquidations: [],
    fundingRequests: [],
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.realtimeListeners.clear();
  api.refreshProjectFlow.mockImplementation((id: string) => api.readProjectFlow(id));
  api.user = { id: 'user-1' };
  resetAuthCaches();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useProjectFlow resilience and caching', () => {
  it('tracks initial loading and retains the snapshot across remounts and transient poll failures', async () => {
    const first = deferred<ProjectFlow>();
    api.readProjectFlow.mockReturnValueOnce(first.promise);

    const hook = renderHook(() => useProjectFlow('proj-1'));
    expect(hook.result.current.loading).toBe(true);
    expect(hook.result.current.data).toBeUndefined();

    const snapshot = makeFlowSnapshot();
    await act(async () => {
      first.resolve(snapshot);
    });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.data?.ready).toBe(true);
    expect(hook.result.current.denied).toBe(false);

    // Unmount and remount while a fresh fetch fails transiently: cached snapshot remains immediately available.
    hook.unmount();
    const secondFetch = deferred<ProjectFlow>();
    api.readProjectFlow.mockReturnValueOnce(secondFetch.promise);
    const remounted = renderHook(() => useProjectFlow('proj-1'));
    expect(remounted.result.current.loading).toBe(false);
    expect(remounted.result.current.data?.project.title).toBe('OutReach');

    await act(async () => {
      secondFetch.reject(new Error('Failed to fetch'));
    });
    await waitFor(() => expect(remounted.result.current.error).toBe("Couldn't load project details. Please try again."));
    expect(remounted.result.current.denied).toBe(false);
    expect(remounted.result.current.data?.ready).toBe(true);
    expect(remounted.result.current.data?.canAllocate).toBe(false);
    remounted.unmount();
  });

  it('clears cached flow data on genuine access denial or auth cache reset', async () => {
    api.readProjectFlow.mockResolvedValueOnce(makeFlowSnapshot());
    const hook = renderHook(() => useProjectFlow('proj-1'));
    await waitFor(() => expect(hook.result.current.data?.ready).toBe(true));

    api.readProjectFlow.mockRejectedValueOnce(new ProjectFlowError('Permission denied', '42501'));
    await act(async () => {
      await hook.result.current.reload();
    });

    expect(hook.result.current.denied).toBe(true);
    expect(hook.result.current.error).toBe("Couldn't verify access to this project.");
    expect(hook.result.current.data).toBeUndefined();

    // After cache reset on sign-out, a fresh mount starts cleanly without stale data.
    resetAuthCaches();
    const next = deferred<ProjectFlow>();
    api.readProjectFlow.mockReturnValueOnce(next.promise);
    const signedOutReload = renderHook(() => useProjectFlow('proj-1'));
    expect(signedOutReload.result.current.loading).toBe(true);
    expect(signedOutReload.result.current.data).toBeUndefined();
    await act(async () => {
      next.resolve(makeFlowSnapshot());
    });
  });

  it('debounces duplicate focus refreshes immediately after mount while allowing explicit reload()', async () => {
    api.readProjectFlow.mockResolvedValue(makeFlowSnapshot());
    const hook = renderHook(() => useProjectFlow('proj-1'));
    await waitFor(() => expect(hook.result.current.data?.ready).toBe(true));
    expect(api.readProjectFlow).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(1);

    await act(async () => {
      await hook.result.current.reload();
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(2);
  });

  it('does not poll periodically when healthy and refreshes only on actions, Realtime events, or tab resume', async () => {
    vi.useFakeTimers();
    api.readProjectFlow.mockResolvedValue(makeFlowSnapshot());
    const hook = renderHook(() => useProjectFlow('proj-1'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.data?.ready).toBe(true);
    expect(api.readProjectFlow).toHaveBeenCalledTimes(1);

    // Idle time passing must not trigger background polling when healthy.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(1);

    // Local workflow/finance events and Realtime invalidation trigger fresh reloads immediately.
    await act(async () => {
      window.dispatchEvent(new Event('eflow:project-setup'));
      await Promise.resolve();
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(2);
    expect(api.refreshProjectFlow).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('eflow:finance-updated'));
      await Promise.resolve();
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(3);

    await act(async () => {
      api.realtimeListeners.get('proj-1')?.();
      await Promise.resolve();
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(4);

    // Realtime while hidden marks stale and refreshes once visible again.
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      api.realtimeListeners.get('proj-1')?.();
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(4);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(5);
    hook.unmount();
  });

  it('retries only while recovering from transient errors and never retries access denials', async () => {
    vi.useFakeTimers();
    api.readProjectFlow
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(makeFlowSnapshot());

    const hook = renderHook(() => useProjectFlow('proj-1'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(hook.result.current.error).toBe("Couldn't load project details. Please try again.");
    expect(api.readProjectFlow).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
      await Promise.resolve();
    });
    expect(hook.result.current.error).toBe('');
    expect(hook.result.current.data?.ready).toBe(true);
    expect(api.readProjectFlow).toHaveBeenCalledTimes(2);

    // Once recovered, no further timer retries occur.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(2);

    // Access denials never schedule automatic retries.
    api.readProjectFlow.mockRejectedValueOnce(new ProjectFlowError('Permission denied', '42501'));
    await act(async () => {
      await hook.result.current.reload();
    });
    expect(hook.result.current.denied).toBe(true);
    expect(api.readProjectFlow).toHaveBeenCalledTimes(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(api.readProjectFlow).toHaveBeenCalledTimes(3);
    hook.unmount();
  });
});
