// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ load: vi.fn(), submit: vi.fn(), decide: vi.fn() }));
vi.mock('../../src/app/features/subtasks/services/subitemLeadReview', () => ({
  fetchSubitemLeadReview: api.load, proposeSubitemWork: api.submit, decideSubitemWork: api.decide,
}));
vi.mock('../../src/app/shared/workChanges', () => ({ subscribeWorkChanges: () => () => {} }));
import { SubitemLeadReview } from '../../src/app/features/subtasks/components/SubitemLeadReview';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const submission = { id: 'proposal', kind: 'completion', state: 'pending', author_id: 'cheryl', reviewer_id: 'cris', canDecide: false, terms: { note: 'Supplies delivered' } };
const base = { root: 'task', node: 'subtask', readOnly: false, pending: false, onChanged: async () => {} };

it('lets the subtask lead submit a completion note and shows the pending review', async () => {
  api.load.mockResolvedValueOnce({ canProposeCompletion: true, items: [] })
    .mockResolvedValue({ canProposeCompletion: true, items: [submission] });
  api.submit.mockResolvedValue(submission);
  render(<SubitemLeadReview {...base} actor="cheryl" reviewerName="Crisostomo Ibarra"/>);
  expect(await screen.findByText(/Crisostomo Ibarra/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Submit for Task Lead review' }));
  fireEvent.change(screen.getByLabelText('Work note'), { target: { value: 'Supplies delivered' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for Task Lead review' }));
  await screen.findByText(/Awaiting Lead review/);
  expect(api.submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ root: 'task', node: 'subtask', kind: 'completion', note: 'Supplies delivered' }));
});

it('lets the assigned Task Lead approve completion through the review action', async () => {
  api.load.mockResolvedValue({ items: [{ ...submission, canDecide: true }] });
  api.decide.mockResolvedValue({ ...submission, state: 'approved' });
  render(<SubitemLeadReview {...base} actor="cris"/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Approve and complete subtask' }));
  await waitFor(() => expect(api.decide).toHaveBeenCalledExactlyOnceWith('proposal', expect.any(String), true, ''));
  await screen.findByText('Completion · Approved');
});
