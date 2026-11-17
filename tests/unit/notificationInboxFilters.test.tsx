// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Notification } from '../../src/app/services/notificationService';
const fixture = vi.hoisted(() => ({ rows: [] as Notification[], count: 60, next: null as unknown,
  filters: {} as any, retry: vi.fn(), more: vi.fn(), mark: vi.fn(async () => {}), one: vi.fn(async () => {}) }));
vi.mock('../../src/app/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' }, userProfile: { role: 'member' } }) }));
vi.mock('../../src/app/features/notifications/hooks/useNotificationInbox', () => ({ useNotificationInbox: (_id: string, filters: unknown) => {
  fixture.filters = filters;
  return { rows: fixture.rows, unreadCount: fixture.count, next: fixture.next, loading: false, refreshing: false, loadingMore: false, error: '', retry: fixture.retry, loadMore: fixture.more };
} }));
vi.mock('../../src/app/services/notificationService', () => ({ markAllNotificationsRead: () => fixture.mark(), markRecentNotificationRead: () => fixture.one() }));
import { UpdatesFeed } from '../../src/app/features/action-center/components/UpdatesFeed';
const notification = (id: string): Notification => ({ id, type: 'approval_needed', title: `Your review ${id}`, message: 'Chris sent the venue check for your review.', reason: 'Please confirm the accessible entrance.', read: false, createdAt: Date.now() });
beforeEach(() => { fixture.rows = [notification('first')]; fixture.count = 60; fixture.next = { id: 'older' }; vi.clearAllMocks(); fixture.mark.mockResolvedValue(undefined); });
afterEach(cleanup);
it('combines activity, unread and time filters and exposes older pages', () => {
  render(<UpdatesFeed onOpen={() => {}} />);
  expect(screen.getByText('60 unread across your inbox')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Activity type'), { target: { value: 'reviews' } });
  fireEvent.change(screen.getByLabelText('Time period'), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('tab', { name: /Unread/ }));
  expect(fixture.filters).toEqual({ category: 'reviews', period: '7', unreadOnly: true });
  fireEvent.click(screen.getByRole('button', { name: 'Load older notifications' })); expect(fixture.more).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(fixture.filters).toEqual({ category: 'all', period: 'all', unreadOnly: false });
  expect(screen.getByText('Please confirm the accessible entrance.')).toBeTruthy();
});
it('keeps newly arriving notifications unread after mark all succeeds', async () => {
  const view = render(<UpdatesFeed onOpen={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
  await waitFor(() => expect(fixture.retry).toHaveBeenCalled());
  fixture.rows = [notification('new'), ...fixture.rows];
  view.rerender(<UpdatesFeed onOpen={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: /Unread/ }));
  expect(screen.getByText('Your review new')).toBeTruthy();
  expect(screen.queryByText('Your review first')).toBeNull();
});
it('keeps unread rows and gives a recovery message if mark all fails', async () => {
  fixture.mark.mockRejectedValue(new Error('SQL internal detail'));
  render(<UpdatesFeed onOpen={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
  await screen.findByText('Couldn’t mark notifications as read');
  fireEvent.click(screen.getByRole('tab', { name: /Unread/ }));
  expect(screen.getByText('Your review first')).toBeTruthy();
  expect(screen.queryByText('SQL internal detail')).toBeNull();
});
it('paginates notifications 10 per page by default across loaded rows', () => {
  fixture.rows = Array.from({ length: 14 }, (_, i) => notification(`item-${i + 1}`));
  render(<UpdatesFeed onOpen={() => {}} />);
  expect(screen.getByText('Showing 1–10 of 14 loaded notifications')).toBeTruthy();
  expect(screen.getByText('Your review item-1')).toBeTruthy();
  expect(screen.queryByText('Your review item-11')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('Showing 11–14 of 14 loaded notifications')).toBeTruthy();
  expect(screen.getByText('Your review item-11')).toBeTruthy();
});
