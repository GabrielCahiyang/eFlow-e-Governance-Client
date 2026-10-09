// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficeReadFeedback } from '../../src/app/features/project-offices/components/OfficeReadFeedback';
import { projectOfficeReadError } from '../../src/app/features/project-offices/presentation';
import { SESSION_REFRESH_MESSAGE } from '../../src/app/shared/userFacingError';

afterEach(cleanup);
describe('Office read feedback', () => {
  it('shows a denied read and lets the user retry once while the retry is pending', async () => {
    let finish!: () => void;
    const retry = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const view = render(<OfficeReadFeedback errors={['Office read denied']} onRetry={retry}/>);
    expect(screen.getByRole('alert').textContent).toContain('Office read denied');
    const button = screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement;
    fireEvent.click(button); fireEvent.click(button);
    expect(retry).toHaveBeenCalledOnce(); expect(button.disabled).toBe(true);
    await act(async () => { finish(); });
    expect(button.disabled).toBe(false);
    view.rerender(<OfficeReadFeedback errors={[]} onRetry={retry}/>);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('retains an explicit retry after another failed attempt without repeating it automatically', async () => {
    const retry = vi.fn().mockRejectedValue(new Error('Office read denied'));
    render(<OfficeReadFeedback errors={['Office read denied']} onRetry={retry}/>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
    expect(screen.getByRole('alert').textContent).toContain('Office read denied');
    expect((screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement).disabled).toBe(false);
    expect(retry).toHaveBeenCalledOnce();
  });

  it('keeps session recovery quiet and does not show a raw expired-token response or an alert', () => {
    render(<OfficeReadFeedback errors={['Invalid or expired Supabase session.', SESSION_REFRESH_MESSAGE]} onRetry={vi.fn()}/>);
    expect(screen.getByRole('status').textContent).toBe('Updating Offices…');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByText(SESSION_REFRESH_MESSAGE)).toBeNull();
    expect(screen.queryByText('Invalid or expired Supabase session.')).toBeNull();
  });

  it('does not hide a real denial when another Office read needs session recovery', () => {
    const error = projectOfficeReadError([new Error('JWT expired'), new Error('Invitation history denied')], 'fallback');
    expect(error).toBe('Invitation history denied');
    render(<OfficeReadFeedback errors={[SESSION_REFRESH_MESSAGE, error, error]} onRetry={vi.fn()} busy/>);
    expect(screen.getByRole('alert').textContent).toBe('Invitation history denied Retry');
    expect(screen.queryByRole('status')).toBeNull();
    expect((screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
