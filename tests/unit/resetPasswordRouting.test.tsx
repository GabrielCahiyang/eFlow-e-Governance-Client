// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EflowVibeThemeProvider } from '../../src/app/shared/vibe';

const authState = vi.hoisted(() => ({
  user: null as { id: string; email?: string } | null,
  userProfile: null as { id: string; role: string } | null,
  loading: false,
  permissionsLoading: false,
  passwordRecovery: false,
  clearPasswordRecovery: vi.fn(),
  accessRevision: 0,
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../src/app/contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({ loading: false }),
}));

vi.mock('../../src/app/components/Auth/LoginPage', () => ({
  LoginPage: () => <div data-testid="login-page">LoginPage</div>,
}));

vi.mock('../../src/app/features/app-shell/SignedInApp', () => ({
  SignedInApp: () => <div data-testid="signed-in-app">SignedInApp</div>,
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import { AuthenticatedApp } from '../../src/app/features/app-shell/AuthenticatedApp';

describe('AuthenticatedApp password recovery routing', () => {
  beforeEach(() => {
    authState.user = null;
    authState.userProfile = null;
    authState.loading = false;
    authState.permissionsLoading = false;
    authState.passwordRecovery = false;
    authState.clearPasswordRecovery.mockReset();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
  });

  it('renders ResetPasswordPage on /reset-password even when unauthenticated', () => {
    window.history.replaceState({}, '', '/reset-password');

    render(
      <EflowVibeThemeProvider preference="light">
        <AuthenticatedApp />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByText('PASSWORD RECOVERY')).toBeTruthy();
    expect(screen.queryByTestId('login-page')).toBeNull();
  });

  it('intercepts signed-in recovery sessions with ResetPasswordPage before SignedInApp', () => {
    authState.user = { id: 'user-1', email: 'staff@ormoc.gov.ph' };
    authState.userProfile = { id: 'user-1', role: 'member' };
    authState.passwordRecovery = true;

    render(
      <EflowVibeThemeProvider preference="light">
        <AuthenticatedApp />
      </EflowVibeThemeProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeTruthy();
    expect(screen.getAllByText('staff@ormoc.gov.ph').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('signed-in-app')).toBeNull();
  });
});
