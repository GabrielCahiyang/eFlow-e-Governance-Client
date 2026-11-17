// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Notification } from '../../src/app/services/notificationService';

const markAllNotificationsReadMock = vi.fn<
  (userId: string) => Promise<void>
>(async () => {});
const markNotificationReadMock = vi.fn<
  (userId: string, notificationId: string) => Promise<void>
>(async () => {});

let seededNotifications: Notification[] = [];

vi.mock('../../src/app/services/notificationService', () => ({
  subscribeToNotifications: vi.fn(
    (_userId: string, onUpdate: (items: Notification[]) => void) => {
      onUpdate(seededNotifications);
      return () => {};
    },
  ),
  markAllNotificationsRead: (userId: string) =>
    markAllNotificationsReadMock(userId),
  markNotificationRead: (userId: string, notificationId: string) =>
    markNotificationReadMock(userId, notificationId),
  markRecentNotificationRead: (userId: string, notificationId: string) =>
    markNotificationReadMock(userId, notificationId),
}));

vi.mock('../../src/app/features/notifications', () => ({
  getNotificationDetail: vi.fn((notification: Notification) =>
    notification.reason
      ? { label: 'Reason', text: notification.reason, tone: 'warning' }
      : null,
  ),
  resolveNotificationDestination: vi.fn((notification: Notification) =>
    notification.taskId
      ? {
          section: 'my-work',
          page: 'tasks',
          label: 'Open subtask review',
          intent: { kind: 'subtask', taskId: notification.taskId },
        }
      : null,
  ),
  queueNotificationNavigationIntent: vi.fn(),
}));

import { NotificationBell } from '../../src/app/components/ui/NotificationBell';

describe('NotificationBell Vibe redesign', () => {
  beforeEach(() => {
    seededNotifications = [
      {
        id: 'notif-unread-1',
        type: 'approval_needed',
        title: 'Subtask ready for review',
        message: 'A teammate requested your approval on Draft budget.',
        reason: 'Due tomorrow',
        taskId: 'task-1',
        read: false,
        createdAt: Date.now() - 5 * 60_000,
      },
      {
        id: 'notif-read-1',
        type: 'comment',
        title: 'New comment on Kickoff brief',
        message: 'Looks good to proceed.',
        read: true,
        createdAt: Date.now() - 45 * 60_000,
      },
    ];
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('filters All and Unread underline tabs, marks all read, and uses zero pill classes', async () => {
    const { container } = render(
      <NotificationBell userId="user-1" role="head" />,
    );

    const trigger = screen.getByRole('button', { name: 'Open notifications' });
    expect(trigger.querySelector('.eflow-bell-trigger__count')?.textContent).toBe('1');
    expect(container.querySelector('.rounded-full')).toBeNull();

    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Notifications' });
    expect(dialog.classList.contains('eflow-notif-panel')).toBe(true);
    expect(dialog.classList.contains('eflow-notif-panel--expanded')).toBe(false);
    expect(document.body.querySelector('.rounded-full')).toBeNull();

    expect(screen.getByText('Subtask ready for review')).toBeTruthy();
    expect(screen.getByText('New comment on Kickoff brief')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Unread/i }));
    expect(screen.getByText('Subtask ready for review')).toBeTruthy();
    expect(screen.queryByText('New comment on Kickoff brief')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Mark all read/i }));
    await waitFor(() => {
      expect(markAllNotificationsReadMock).toHaveBeenCalledWith('user-1');
    });

    expect(screen.getByText("You're all caught up")).toBeTruthy();
  });

  it('toggles between floating popover and expanded view via the expand button', () => {
    render(<NotificationBell userId="user-1" role="head" />);

    fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
    const dialog = screen.getByRole('dialog', { name: 'Notifications' });
    expect(dialog.classList.contains('eflow-notif-panel--expanded')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Expand notifications' }));
    expect(dialog.classList.contains('eflow-notif-panel--expanded')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse notifications' }));
    expect(dialog.classList.contains('eflow-notif-panel--expanded')).toBe(false);
  });

  it('navigates from the notification dialog to full Inbox notifications via View all in Inbox', () => {
    const onNavigate = vi.fn();
    render(<NotificationBell userId="user-1" role="head" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'View all in Inbox' }));
    expect(onNavigate).toHaveBeenCalledWith('inbox', 'Notifications');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });
});
