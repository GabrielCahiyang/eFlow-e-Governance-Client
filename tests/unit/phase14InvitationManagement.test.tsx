// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ resend: vi.fn(), revoke: vi.fn(), confirm: vi.fn(), clipboard: vi.fn() }));
vi.mock('../../src/app/features/invitations/services/invitationService', () => ({ resendInvitation: calls.resend, revokeInvitation: calls.revoke }));
vi.mock('../../src/app/components/ui/useConfirmation', () => ({ useConfirmation: () => ({ confirm: calls.confirm, dialog: null }) }));
import { useInvitationManagement } from '../../src/app/features/invitations/hooks/useInvitationManagement';
import type { Invitation } from '../../src/app/features/invitations/types';
const item = { id: 'invite', email: 'member@example.test', status: 'pending', account_role: 'member' } as Invitation;
beforeEach(() => { vi.clearAllMocks(); calls.confirm.mockResolvedValue(true); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: calls.clipboard } }); }); afterEach(cleanup);
describe('Phase 14 invitation management', () => {
 it('refreshes renewed validity even when clipboard or delivery fails and retains a manual copy link', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined); calls.resend.mockResolvedValue({ invitation_url: 'synthetic-private-link', delivery_error: 'Mail failed' }); calls.clipboard.mockRejectedValue(new Error('Clipboard unavailable'));
  const { result } = renderHook(() => useInvitationManagement('own', refresh)); await act(async () => result.current.manage(item, 'copy', () => true));
  expect(calls.resend).toHaveBeenCalledWith('invite', true); expect(refresh).toHaveBeenCalledOnce(); expect(result.current.freshLink).toBe('synthetic-private-link'); expect(result.current.receipt).toContain('previous link is invalid'); expect(result.current.error).toContain('Clipboard copy failed');
 });
 it('rechecks authority after confirmation and declines writes when authority is revoked', async () => {
  let authority = true; calls.confirm.mockImplementation(async () => { authority = false; return true; }); const refresh = vi.fn();
  const { result } = renderHook(() => useInvitationManagement('own', refresh)); await act(async () => result.current.manage(item, 'revoke', () => authority)); expect(calls.revoke).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
 });
 it('deduplicates repeated action requests and ignores results after actor scope changes', async () => {
  let finish!: (value: unknown) => void; calls.resend.mockImplementation(() => new Promise(r => { finish = r; }));
  const { result, rerender } = renderHook(({scope}) => useInvitationManagement(scope, vi.fn()), { initialProps: { scope: 'one' } });
  let request!: Promise<void>; await act(async () => { request = result.current.manage(item, 'copy', () => true); }); await act(async () => result.current.manage(item, 'copy', () => true)); expect(calls.resend).toHaveBeenCalledOnce();
  rerender({ scope: 'two' }); await act(async () => { finish({ invitation_url: 'synthetic-private-link' }); await request; }); await waitFor(() => expect(result.current.freshLink).toBe('')); expect(calls.clipboard).not.toHaveBeenCalled();
 });
});
