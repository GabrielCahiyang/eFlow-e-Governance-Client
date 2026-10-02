// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthListener = (event: string, session: { user: { id: string } } | null) => unknown;

let authListener: AuthListener | null = null;
let resolveProfile: ((value: { data: Record<string, unknown>; error: null }) => void) | null = null;

const single = vi.fn(() => new Promise<{ data: Record<string, unknown>; error: null }>((resolve) => {
  resolveProfile = resolve;
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((listener: AuthListener) => {
        authListener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../src/app/services/permissionService', () => ({
  fetchEffectivePermissions: vi.fn(async () => new Set<string>()),
  resolvePermissions: vi.fn(() => new Set<string>()),
}));

vi.mock('../../src/app/shared/controlPanelClient', () => ({
  controlPanelFetch: vi.fn(),
}));

import { AuthProvider, useAuth } from '../../src/app/contexts/AuthContext';

function AuthProbe({ children }: { children?: ReactNode }) {
  const { loading, userProfile, can } = useAuth();
  return (
    <div data-testid="auth-state">
      {loading ? 'loading' : userProfile?.full_name ?? 'ready-without-profile'}
      <span data-testid="role">{userProfile?.role}</span>
      <span data-testid="management-access">{String(can('users.manage'))}</span>
      {children}
    </div>
  );
}

describe('authenticated application startup', () => {
  afterEach(cleanup);
  beforeEach(() => {
    authListener = null;
    resolveProfile = null;
    single.mockClear();
  });

  it('returns from the auth listener before loading the signed-in profile', async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(authListener).not.toBeNull();

    let listenerResult: unknown;
    act(() => {
      listenerResult = authListener?.('INITIAL_SESSION', { user: { id: 'user-1' } });
    });

    // A Promise here would mean database work is once again running inside
    // Supabase's auth callback and can reproduce the infinite loading bug.
    expect(listenerResult).toBeUndefined();
    expect(screen.getByTestId('auth-state').textContent).toContain('loading');

    await waitFor(() => expect(resolveProfile).not.toBeNull());
    await act(async () => {
      resolveProfile?.({
        data: {
          id: 'user-1',
          full_name: 'Test User',
          role: 'employee',
          is_active: true,
        },
        error: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toContain('Test User');
    });
  });

  it.each(['admin', 'super_admin'])('refreshes %s sessions and removes access after deactivation', async (role) => {
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    act(() => { authListener?.('INITIAL_SESSION', { user: { id: 'admin-1' } }); });
    await act(async () => {
      resolveProfile?.({ data: { id: 'admin-1', full_name: 'Admin', role, is_active: true }, error: null });
    });
    expect(screen.getByTestId('role').textContent).toBe('admin');
    expect(screen.getByTestId('management-access').textContent).toBe('true');
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(single).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveProfile?.({ data: { id: 'admin-1', full_name: 'Admin', role: 'admin', is_active: false }, error: null });
    });
    expect(screen.getByTestId('management-access').textContent).toBe('false');
  });
});
