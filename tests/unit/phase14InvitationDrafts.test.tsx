// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installNavigationConfirmation } from '../../src/app/shared/navigationGuard';
const calls = vi.hoisted(() => ({ send: vi.fn(), upload: vi.fn(), confirm: vi.fn() }));
vi.mock('../../src/app/features/invitations/services/invitationService', () => ({ sendInvitations: calls.send }));
vi.mock('../../src/app/shared/skillTags', () => ({ useSkillTags: () => ({ activeLabels: ['Project Management', 'Financial Analysis'], loading: false }) }));
vi.mock('../../src/app/components/ui/useConfirmation', () => ({ useConfirmation: () => ({ confirm: calls.confirm, dialog: null }) }));
import { InviteMemberDialog } from '../../src/app/features/invitations/components/InviteMemberDialog';
let uninstall: (() => void) | undefined;
beforeEach(() => { vi.clearAllMocks(); calls.confirm.mockResolvedValue(true); });
afterEach(() => { cleanup(); uninstall?.(); });
const invitation = { id: 'created', delivery_error: 'Mail unavailable' };
describe('Phase 14 invitation drafts', () => {
 it('defaults to 1 person row with skill tag selector (no PDS attachment) and adds rows on demand', async () => {
  calls.send.mockResolvedValueOnce({ results: [{ email: 'ok@example.test', invitation }, { email: 'retry@example.test', error: 'Try again' }] }).mockResolvedValueOnce({ results: [{ email: 'retry@example.test', invitation: { id: 'second' } }] });
  const sent = vi.fn(); render(<InviteMemberDialog officeName="Planning" open onOpenChange={vi.fn()} onSent={sent}/>);
  expect(screen.getAllByPlaceholderText('Add email here')).toHaveLength(1);
  expect(screen.queryByText(/Attach PDS PDF/i)).toBeNull();
  expect(screen.getByText('Project Management')).toBeTruthy();
  fireEvent.click(screen.getByText('Project Management'));
  fireEvent.click(screen.getByRole('button', { name: /Add another person/i }));
  expect(screen.getAllByPlaceholderText('Add email here')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('Email address 1'), { target: { value: 'ok@example.test' } }); fireEvent.change(screen.getByLabelText('Email address 2'), { target: { value: 'retry@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send invitations' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('1 invitation created'));
  expect(calls.send.mock.calls[0][0]).toEqual([
   { email: 'ok@example.test', account_role: 'member', skills: ['Project Management'] },
   { email: 'retry@example.test', account_role: 'member' },
  ]);
  expect(screen.getAllByPlaceholderText('Add email here').map(i => (i as HTMLInputElement).value)).toEqual(['retry@example.test']);
  fireEvent.click(screen.getByRole('button', { name: 'Send invitations' })); await waitFor(() => expect(calls.send).toHaveBeenCalledTimes(2));
  expect(calls.send.mock.calls[1][0]).toEqual([{ email: 'retry@example.test', account_role: 'member' }]);
 });
 it('keeps drafts on dismissal refusal and discards only after explicit acceptance', async () => {
  const decision = vi.fn().mockResolvedValue(false), close = vi.fn(); uninstall = installNavigationConfirmation(decision);
  render(<InviteMemberDialog officeName="Planning" open onOpenChange={close} onSent={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Email address 1'), { target: { value: 'draft@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remind me later' })); await waitFor(() => expect(decision).toHaveBeenCalledOnce()); expect(close).not.toHaveBeenCalled();
  decision.mockResolvedValue(true); await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remind me later' }))); expect(close).toHaveBeenCalledWith(false);
 });
 it('does not send after cancelled recipient review and synchronously deduplicates submits', async () => {
  let resolve!: (value: unknown) => void; calls.send.mockImplementation(() => new Promise(r => { resolve = r; }));
  render(<InviteMemberDialog officeName="Planning" open onOpenChange={vi.fn()} onSent={vi.fn()}/>); fireEvent.change(screen.getByLabelText('Email address 1'), { target: { value: 'draft@example.test' } });
  calls.confirm.mockResolvedValueOnce(false); fireEvent.click(screen.getByRole('button', { name: 'Send invitations' })); await waitFor(() => expect(calls.confirm).toHaveBeenCalledOnce()); expect(calls.send).not.toHaveBeenCalled();
  const form = screen.getByLabelText('Email address 1').closest('form')!; await act(async () => { fireEvent.submit(form); fireEvent.submit(form); }); expect(calls.send).toHaveBeenCalledOnce();
  await act(async () => resolve({ results: [{ email: 'draft@example.test', error: 'Denied' }] })); expect((screen.getByLabelText('Email address 1') as HTMLInputElement).value).toBe('draft@example.test');
 });
});
