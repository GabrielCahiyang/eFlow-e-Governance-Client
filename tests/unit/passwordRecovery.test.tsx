// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EflowVibeThemeProvider } from '../../src/app/shared/vibe';

const storage = new Map<string, string>();
const storageMock = {
  clear: () => storage.clear(),
  getItem: (key: string) => storage.get(key) ?? null,
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  get length() {
    return storage.size;
  },
  removeItem: (key: string) => storage.delete(key),
  setItem: (key: string, value: string) => storage.set(key, String(value)),
};

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storageMock });
Object.defineProperty(window, 'localStorage', { configurable: true, value: storageMock });

type AuthListener = (event: string, session: { user: { id: string; email?: string } } | null) => void;

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  verifyOtp: vi.fn(async () => ({ data: { session: { user: { id: 'user-1' } } }, error: null })),
  updateUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
  getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  authListener: null as AuthListener | null,
  authLogin: vi.fn(async () => undefined),
  clearError: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('../../src/app/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    userProfile: null,
    loading: false,
    permissionsLoading: false,
    passwordRecovery: false,
    error: null,
    login: mocks.authLogin,
    resetPassword: vi.fn(async () => undefined),
    clearPasswordRecovery: vi.fn(),
    logout: vi.fn(async () => undefined),
    updateUserProfile: vi.fn(),
    clearError: mocks.clearError,
    can: () => false,
    permissions: new Set<string>(),
  }),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      verifyOtp: mocks.verifyOtp,
      updateUser: mocks.updateUser,
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      onAuthStateChange: vi.fn((listener: AuthListener) => {
        mocks.authListener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ count: 1, error: null }),
        }),
      }),
    }),
  },
}));

import { LoginPage } from '../../src/app/components/Auth/LoginPage';
import {
  ResetPasswordPage,
  extractRecoveryTokenHash,
  getResetPasswordRedirectUrl,
  hasRecoveryParamsInUrl,
  parseRecoveryErrorFromUrl,
  validateRecoveryEmail,
  validateResetPasswordFields,
} from '../../src/app/features/authentication';

describe('Password recovery helpers, forgot-password UI, and dedicated reset page', () => {
  beforeEach(() => {
    mocks.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
    mocks.verifyOtp.mockReset().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null });
    mocks.updateUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
    mocks.fetchMock.mockReset().mockResolvedValue(
      new Response(JSON.stringify({ sent: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', mocks.fetchMock);
    mocks.authListener = null;
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('validates recovery email, password length/matching, and recovery URL parsing', () => {
    expect(validateRecoveryEmail('')).toBe('Enter your email address.');
    expect(validateRecoveryEmail('not-an-email')).toBe('Enter a valid email address.');
    expect(validateRecoveryEmail('staff@ormoc.gov.ph')).toBeUndefined();

    expect(validateResetPasswordFields('short123', 'short123')).toContain('12 to 128 characters');
    expect(validateResetPasswordFields('valid-password-123', 'mismatch-123456')).toBe('The passwords do not match.');
    expect(validateResetPasswordFields('valid-password-123', 'valid-password-123')).toBeUndefined();

    expect(hasRecoveryParamsInUrl('', '#access_token=abc&type=recovery')).toBe(true);
    expect(hasRecoveryParamsInUrl('?token_hash=xyz&type=recovery', '')).toBe(true);
    expect(extractRecoveryTokenHash('?token_hash=xyz&type=recovery', '')).toBe('xyz');
    expect(hasRecoveryParamsInUrl('?code=pkce-code', '')).toBe(true);
    expect(hasRecoveryParamsInUrl('', '')).toBe(false);

    expect(parseRecoveryErrorFromUrl('', '#error=access_denied&error_code=otp_expired')).toContain('expired');
    expect(parseRecoveryErrorFromUrl('', '')).toBeNull();
    expect(getResetPasswordRedirectUrl()).toBe(`${window.location.origin}/reset-password`);
  });

  it('keeps Forgot password? in the same tab, sends reset email via gateway, and returns cleanly', async () => {
    render(
      <EflowVibeThemeProvider preference="light">
        <LoginPage />
      </EflowVibeThemeProvider>,
    );

    const forgotButton = screen.getByRole('button', { name: 'Forgot password?' });
    expect(forgotButton.getAttribute('type')).toBe('button');
    expect(forgotButton.tagName).toBe('BUTTON');

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'juan.delacruz@ormoc.gov.ph' },
    });
    fireEvent.click(forgotButton);

    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeTruthy();
    const forgotInput = screen.getByLabelText('Email address') as HTMLInputElement;
    expect(forgotInput.value).toBe('juan.delacruz@ormoc.gov.ph');

    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(mocks.fetchMock).toHaveBeenCalledWith(
        '/controlpanelEflow/api/auth/forgot-password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'juan.delacruz@ormoc.gov.ph' }),
        }),
      );
    });

    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('juan.delacruz@ormoc.gov.ph');

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('heading', { name: 'Sign in to eFlow' })).toBeTruthy();
  });

  it('verifies token_hash links on /reset-password and renders the password form', async () => {
    window.history.replaceState({}, '', '/reset-password?token_hash=directhash99&type=recovery');
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'andres@ormoc.gov.ph' } } } as never,
      error: null,
    });

    render(
      <EflowVibeThemeProvider preference="light">
        <ResetPasswordPage />
      </EflowVibeThemeProvider>,
    );

    await waitFor(() => {
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'directhash99',
        type: 'recovery',
      });
      expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeTruthy();
    });
    expect(screen.getAllByText('andres@ormoc.gov.ph').length).toBeGreaterThan(0);
    expect(window.location.search).toBe('');
  });

  it('shows invalid link state on /reset-password when URL carries an expired error', async () => {
    window.history.replaceState({}, '', '/reset-password#error=access_denied&error_code=otp_expired');

    render(
      <EflowVibeThemeProvider preference="light">
        <ResetPasswordPage />
      </EflowVibeThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Reset link unavailable' })).toBeTruthy();
    });
    expect(screen.getByRole('alert').textContent).toContain('expired');
    expect(window.location.pathname).toBe('/reset-password');
    expect(window.location.hash).toBe('');
  });

  it('completes password reset on /reset-password, validates policy, signs out recovery session, and renders success', async () => {
    window.history.replaceState({}, '', '/reset-password#access_token=tok&type=recovery');
    const onRecoveryComplete = vi.fn();

    render(
      <EflowVibeThemeProvider preference="light">
        <ResetPasswordPage onRecoveryComplete={onRecoveryComplete} />
      </EflowVibeThemeProvider>,
    );

    act(() => {
      mocks.authListener?.('PASSWORD_RECOVERY', {
        user: { id: 'user-1', email: 'juan.delacruz@ormoc.gov.ph' },
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeTruthy();
    });
    expect(screen.getAllByText('juan.delacruz@ormoc.gov.ph').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'too-short' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'too-short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(screen.getAllByRole('alert').some((el) => el.textContent?.includes('at least 12 characters'))).toBe(true);
    expect(mocks.updateUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'OrmocNewPass2026!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'OrmocNewPass2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'OrmocNewPass2026!' });
      expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(onRecoveryComplete).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole('heading', { name: 'Password updated' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go to sign in' })).toBeTruthy();
  });
});
