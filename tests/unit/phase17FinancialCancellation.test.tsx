// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ cancel: vi.fn(), acknowledge: vi.fn() }));
vi.mock('../../src/app/features/budget/services/budgetService', () => ({ cancelContextualCashRequest: calls.cancel, acknowledgePettyCashRelease: calls.acknowledge, createReceiptSignedUrl: vi.fn() }));
vi.mock('../../src/app/features/budget/components/CashLiquidationDialog', () => ({ CashLiquidationDialog: () => null }));
import { CashRequestTimeline } from '../../src/app/features/budget/components/CashRequestTimeline';
import type { DepartmentBudgetBundle, PettyCashRequest } from '../../src/app/features/budget/types';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const request = { id: 'request', requestNumber: 8, requesterId: 'actor', purpose: 'Community workshop', requestedAmount: 4000, status: 'pending', updatedAt: 1 } as PettyCashRequest;
const data = { allocationLines: [], releases: [], liquidations: [], requestAttachments: [] } as unknown as DepartmentBudgetBundle;
const props = (onChanged = vi.fn().mockResolvedValue(undefined)) => ({ data, requests: [request], currentUserId: 'actor', orgId: 'office', onCorrect: vi.fn(), onChanged });
describe('Phase 17 funding cancellation', () => {
  it('shows the amount and requires a reason; cancellation performs no write', async () => {
    render(<CashRequestTimeline {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('4,000');
    expect((within(dialog).getByRole('button', { name: 'Cancel request' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel', exact: true }));
    expect(calls.cancel).not.toHaveBeenCalled();
  });
  it('rejects a newly released request after preview without writing', async () => {
    const input = props(), view = render(<CashRequestTimeline {...input} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.change(screen.getByLabelText(/Cancellation reason/), { target: { value: 'Cancelled event' } });
    view.rerender(<CashRequestTimeline {...input} requests={[{ ...request, status: 'released', updatedAt: 2 }]} />);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel request' }));
    await screen.findByText(/cash request changed/); expect(calls.cancel).not.toHaveBeenCalled();
  });
  it('retains the successful cancellation receipt on refresh failure and prevents replay', async () => {
    calls.cancel.mockResolvedValue(undefined);
    const input = props(vi.fn().mockRejectedValue(new Error('Read unavailable')));
    render(<CashRequestTimeline {...input} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.change(screen.getByLabelText(/Cancellation reason/), { target: { value: 'Cancelled event' } });
    const apply = within(dialog).getByRole('button', { name: 'Cancel request' }); fireEvent.click(apply); fireEvent.click(apply);
    await screen.findByText(/Funding action recorded. The view could not refresh/);
    expect(calls.cancel).toHaveBeenCalledExactlyOnceWith('request', 'Cancelled event');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull()); expect(calls.cancel).toHaveBeenCalledTimes(1);
  });
});
