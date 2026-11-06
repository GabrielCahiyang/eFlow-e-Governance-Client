// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
const setup = vi.hoisted(() => ({ role: 'member', assistant: 'reviewer', subscribe: vi.fn(), feed: vi.fn().mockResolvedValue([]) }));
vi.mock('../../src/app/features/budget/services/financialReviewSubscription', () => ({ subscribeFinancialReviewChanges: setup.subscribe }));
vi.mock('../../src/app/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'reviewer' }, userProfile: { id: 'reviewer', org_id: 'office', is_active: true, role: setup.role } }) }));
vi.mock('../../src/app/hooks/useSupabaseData', () => ({ useOrgs: () => ({ orgs: [{ id: 'office', is_active: true, assistant_head_user_id: setup.assistant }] }) }));
vi.mock('../../src/app/features/notifications', () => ({ useNotificationNavigationIntent: vi.fn() }));
vi.mock('../../src/app/features/budget/services/independentReviewService', () => ({ getAssignedIndependentReviews: setup.feed }));
vi.mock('../../src/app/features/budget/components/IndependentReviewPackageCard', () => ({ IndependentReviewPackageCard: () => <p>Assigned receipt package</p> }));
import { AssignedIndependentReviews } from '../../src/app/features/budget/components/AssignedIndependentReviews';
afterEach(cleanup);
beforeEach(() => { setup.role = 'member'; setup.assistant = 'reviewer'; setup.subscribe.mockReset().mockReturnValue(() => {}); setup.feed.mockReset().mockResolvedValue([]); });
it('keeps assigned packages mounted while a realtime event reloads the feed', async () => {
  const rows = [{ liquidation: { id: 'liq' }, context: {}, request: {} }];
  setup.feed.mockResolvedValue(rows);
  render(<AssignedIndependentReviews />);
  await screen.findByText('Assigned receipt package');
  expect(screen.queryByRole('button', { name: 'Refresh assigned reviews' })).toBeNull();
  let resolve!: (value: unknown) => void;
  setup.feed.mockReturnValueOnce(new Promise(value => { resolve = value; }));
  act(() => setup.subscribe.mock.calls[0][2]());
  await waitFor(() => expect(setup.feed).toHaveBeenCalledTimes(2));
  expect(screen.getByText('Assigned receipt package')).toBeTruthy();
  await act(async () => resolve([]));
  expect(screen.queryByText('Assigned receipt package')).toBeNull();
});
it('lets an appointed Member receive their review without granting a Head account role', async () => {
  setup.feed.mockResolvedValue([{ liquidation: { id: 'liq' }, context: {}, request: {} }]);
  render(<AssignedIndependentReviews />);
  expect(await screen.findByText('Assigned receipt package')).toBeTruthy();
  expect(setup.feed).toHaveBeenCalledWith('reviewer');
});
it('does not fetch financial review data for an unappointed Member', () => {
  setup.assistant = 'someone-else'; render(<AssignedIndependentReviews />);
  expect(setup.feed).not.toHaveBeenCalled();
});
it('does not treat an Admin label as operational independent-review authority', () => {
  setup.role = 'admin'; render(<AssignedIndependentReviews />);
  expect(setup.feed).not.toHaveBeenCalled();
});
