import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refreshSession } = vi.hoisted(() => ({ refreshSession: vi.fn() }));
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth: { refreshSession } } }));
import { withSupabaseSessionRetry } from '../../src/app/shared/supabaseSession';
import { SESSION_REFRESH_MESSAGE } from '../../src/app/shared/userFacingError';

describe('automatic session recovery', () => {
  beforeEach(() => {
    refreshSession.mockReset();
    refreshSession.mockResolvedValue({ data: { session: { user: { id: 'head' } } }, error: null });
  });
  it('refreshes an expired session and retries once without exposing the first failure', async () => {
    const request = vi.fn().mockResolvedValueOnce({ error: { code: 'PGRST301', message: 'JWT expired' } })
      .mockResolvedValueOnce({ data: ['Office'], error: null });
    await expect(withSupabaseSessionRetry(request)).resolves.toEqual({ data: ['Office'], error: null });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('also recovers a rejected authentication request', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('Invalid or expired Supabase session.'))
      .mockResolvedValueOnce({ data: [], error: null });
    await expect(withSupabaseSessionRetry(request)).resolves.toEqual({ data: [], error: null });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not repeat a successful mutation or a business rejection', async () => {
    for (const response of [{ data: null, error: null }, { error: { message: 'This Office has project work.' } }]) {
      const request = vi.fn().mockResolvedValue(response);
      await expect(withSupabaseSessionRetry(request)).resolves.toBe(response);
      expect(request).toHaveBeenCalledTimes(1);
    }
    expect(refreshSession).not.toHaveBeenCalled();
  });
  it('does not repeat an ambiguous transport failure', async () => {
    const request = vi.fn().mockRejectedValue(new Error('Connection interrupted'));
    await expect(withSupabaseSessionRetry(request)).rejects.toThrow('Connection interrupted');
    expect(request).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });
  it('limits unsuccessful recovery to one refresh and one retry', async () => {
    const request = vi.fn().mockResolvedValue({ error: { code: 'PGRST301', message: 'JWT expired' } });
    await expect(withSupabaseSessionRetry(request)).rejects.toThrow(SESSION_REFRESH_MESSAGE);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not replay the request if refreshing the session failed', async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('refresh token expired') });
    const request = vi.fn().mockResolvedValue({ error: { code: 'PGRST301', message: 'JWT expired' } });
    await expect(withSupabaseSessionRetry(request)).rejects.toThrow(SESSION_REFRESH_MESSAGE);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
