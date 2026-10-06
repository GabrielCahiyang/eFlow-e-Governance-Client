// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalOfficeDialog } from '../../src/app/features/project-offices/components/LocalOfficeDialog';
const service = vi.hoisted(() => ({ save: vi.fn(), invite: vi.fn() }));
vi.mock('../../src/app/features/project-offices/services/officeIdentityService', () => ({ saveOfficeIdentity: service.save, inviteOfficeIdentity: service.invite }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  service.save.mockResolvedValue({ id: 'stable-office', display_name: 'Planning Office' });
  service.invite.mockResolvedValue({ id: 'invite' });
});
describe('project-local Office creation', () => {
  it('retains an Office name without requiring a canonical record or contact', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<LocalOfficeDialog projectId="project" onClose={vi.fn()} onSaved={refresh}/>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Office name' }), { target: { value: 'Planning Office' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Office' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Office name saved'));
    expect(service.save).toHaveBeenCalledWith('project', expect.any(String), 'Planning Office', '');
    expect(service.invite).not.toHaveBeenCalled();
  });
  it('distinguishes a saved invitation from delivery and refresh failures', async () => {
    service.invite.mockResolvedValue({ id: 'invite', delivery_error: 'Provider unavailable' });
    render(<LocalOfficeDialog projectId="project" initialName="Planning Office" onClose={vi.fn()} onSaved={vi.fn().mockRejectedValue(new Error('read failed'))}/>);
    fireEvent.change(screen.getByRole('textbox', { name: /Contact email/ }), { target: { value: 'contact@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & invite contact' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('invitation saved'));
    expect(screen.getByRole('alert').textContent).toContain('Saved, but could not refresh');
    expect(screen.queryByRole('button', { name: 'Save & invite contact' })).toBeNull();
    expect(service.invite).toHaveBeenCalledOnce();
  });
  it('retains failed drafts and retries the saved identity instead of creating a second one', async () => {
    service.invite.mockRejectedValueOnce(new Error('Check delivery outcome')).mockResolvedValueOnce({ id: 'invite' });
    render(<LocalOfficeDialog projectId="project" initialName="Planning Office" onClose={vi.fn()} onSaved={vi.fn().mockResolvedValue(undefined)}/>);
    const email = screen.getByRole('textbox', { name: /Contact email/ });
    fireEvent.change(email, { target: { value: 'contact@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & invite contact' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Check delivery outcome'));
    expect((email as HTMLInputElement).value).toBe('contact@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Save & invite contact' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('contact invited'));
    expect(service.save.mock.calls[1][1]).toBe('stable-office');
    expect(service.invite.mock.calls.every(call => call[0] === 'stable-office')).toBe(true);
  });
  it('keeps the dialog open until a dirty draft is explicitly discarded', () => {
    const close = vi.fn();
    render(<LocalOfficeDialog projectId="project" onClose={close} onSaved={vi.fn()}/>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Office name' }), { target: { value: 'Unsaved Office' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect((screen.getByRole('textbox', { name: 'Office name' }) as HTMLInputElement).value).toBe('Unsaved Office');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(close).toHaveBeenCalledOnce();
    expect(service.save).not.toHaveBeenCalled();
  });
});
